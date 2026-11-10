#!/usr/bin/env python3
"""현황 최신화 오케스트레이터 — 회사 PC 폴러(`poll-local.ps1`)가 요청 1건마다 한 번 부른다.

단계 목록(REGISTERED)을 차례로 돌리고 서버 POST 본문을 `--out` 에 쓴다. 본문은
`ensure_ascii=True` 라 ASCII 바이트뿐이다 — ps1 은 그 바이트를 그대로 보낸다
(Windows PowerShell 5.1 의 ConvertTo-Json 깊이 2·문자열 본문 ISO-8859-1 을 둘 다 피한다).

사용 (레포 루트에서):
  python -I -X utf8 -u scripts/sms-status-refresh/refresh.py \\
    --request-id <id> --work-dir <폴더> --out <폴더>/body.json \\
    [--watermarks <폴더>/watermarks.json] [--steps moa]

env:
  SMS_STATUS_REFRESH_DRY_RUN=true   Teams 에 아무것도 올리지 않는다(시험 실행)
  SMS_STATUS_REFRESH_ENV_FILE=<경로>  읽을 env 파일(기본: 레포 루트 .env.local). 이미 있는 값은 안 덮는다

종료 코드: 본문을 썼으면 0(단계 실패여도 — 실패는 본문이 말한다), 인자가 틀리면 2.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

# `python -I` 는 스크립트 폴더를 sys.path 에 넣지 않는다 — 자기 폴더와 Moa 로그인 모듈 폴더를 직접 넣는다.
_HERE = Path(__file__).resolve().parent
_REPO_ROOT = _HERE.parent.parent
for _p in (_HERE.parent / "moa-closing", _HERE):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from contract import STEP_IDS, Context, Step, build_body, run_steps  # noqa: E402
from mail_step import run_mail_step  # noqa: E402
from moa_collect import run_moa_step  # noqa: E402
from pims_collect import run_pims_step  # noqa: E402
from workbook_step import run_workbook_step  # noqa: E402

# 실행 전체 예산 — 작업 스케줄러 실행 제한(30분, register-poll-task.ps1)보다 5분 짧게 둔다.
# 남는 5분이 결과 보고·작업 폴더 정리 몫이다. 두 값은 stale-vs-limit.test.ts·test_run_budget.py 가 묶는다.
RUN_BUDGET_S = 25 * 60

# 단계 id → Step. selenium·Moa 로그인 모듈은 단계 함수 안에서 늦게 import 한다(테스트가 브라우저 없이 돈다).
REGISTERED: dict[str, Step] = {
    # 맨 앞 — 같은 실행의 workbook 이 방금 저장한 세종 리스트를 쓴다. 실패해도 뒤 단계는 돈다
    "mail": Step("mail", run_mail_step),
    "moa": Step("moa", run_moa_step),
    "pims": Step("pims", run_pims_step),  # needs 없음 — Moa 가 실패해도 돈다
    # needs 없음 — 앞 단계가 실패해도 Teams 의 그 시점 최신 목록으로 돈다(요약에 '지난 자료')
    "workbook": Step("workbook", run_workbook_step),
}


def _load_env() -> bool:
    """env 파일을 읽는다(이미 있는 값은 안 덮는다). python-dotenv 가 없으면 False.

    없는 채로 돌면 Moa 계정 env 가 비어 'Moa 로그인 실패' 로 잘못 보인다 — 인자 오류처럼 2 로 끝낸다.
    """
    env_file = os.getenv("SMS_STATUS_REFRESH_ENV_FILE") or str(_REPO_ROOT / ".env.local")
    try:
        from dotenv import load_dotenv
    except ImportError:
        print("[FAIL] python-dotenv 없음 — pip install -r scripts/sms-status-refresh/requirements.txt")
        return False
    load_dotenv(env_file, override=False)
    return True


def _parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="SMS 현황 최신화")
    p.add_argument("--request-id", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--work-dir", required=True)
    p.add_argument("--watermarks")
    p.add_argument("--steps")
    return p.parse_args(argv)


def _pick_steps(raw: str | None) -> list[Step] | None:
    ids = [s.strip() for s in raw.split(",") if s.strip()] if raw else list(STEP_IDS)
    unknown = [i for i in ids if i not in REGISTERED]
    if unknown or not ids:
        print(f"[FAIL] 모르는 단계: {unknown}")
        return None
    return [REGISTERED[i] for i in ids]


def _read_watermarks(path: str | None) -> dict[str, str] | None:
    if not path:
        return {}
    data = json.loads(Path(path).read_text(encoding="utf-8-sig"))
    if data is None:
        return {}
    if not isinstance(data, dict) or not all(isinstance(v, str) for v in data.values()):
        print("[FAIL] watermarks 파일은 문자열 값의 JSON 객체여야 합니다")
        return None
    return {str(k): v for k, v in data.items()}


def main(argv: list[str]) -> int:
    args = _parse_args(argv)
    started = time.monotonic()  # 인자·env 읽기도 예산에 넣는다
    # 로그인 실패 덤프(scrape._dump_page, 기본 현재 폴더)가 레포 루트 — 스케줄러가 돌리는 원래 폴더 —
    # 에 fail-login.* 을 남기지 않게 요청 작업 폴더로 보낸다. 이미 정했으면(.env.local 포함) 그대로.
    os.environ.setdefault("CLOSING_DUMP_DIR", args.work_dir)
    if not _load_env():
        return 2
    steps = _pick_steps(args.steps)
    watermarks = _read_watermarks(args.watermarks)
    if steps is None or watermarks is None:
        return 2

    ctx = Context(
        request_id=args.request_id,
        watermarks=watermarks,
        dry_run=os.getenv("SMS_STATUS_REFRESH_DRY_RUN", "").lower() == "true",
        work_dir=Path(args.work_dir),
        results={},
        deadline=started + RUN_BUDGET_S,
    )
    results = run_steps(steps, ctx)
    for r in results:
        # 폴러는 실패 보고에 [태그] 만 싣는다 — 단계·상태·코드를 태그 안에 둔다.
        print(f"[STEP:{r.step}:{r.status}:{r.error_code or '-'}]")

    body = build_body(args.request_id, results)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(body, ensure_ascii=True), encoding="ascii")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
