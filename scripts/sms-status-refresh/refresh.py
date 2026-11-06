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
from pathlib import Path

# `python -I` 는 스크립트 폴더를 sys.path 에 넣지 않는다 — 자기 폴더와 Moa 로그인 모듈 폴더를 직접 넣는다.
_HERE = Path(__file__).resolve().parent
_REPO_ROOT = _HERE.parent.parent
for _p in (_HERE.parent / "moa-closing", _HERE):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from contract import STEP_IDS, Context, Step, build_body, run_steps  # noqa: E402

# 단계 id → Step. Moa·Graph 모듈은 단계 함수 안에서 늦게 import 한다(테스트가 selenium 없이 돈다).
REGISTERED: dict[str, Step] = {}


def _load_env() -> None:
    env_file = os.getenv("SMS_STATUS_REFRESH_ENV_FILE") or str(_REPO_ROOT / ".env.local")
    try:
        from dotenv import load_dotenv
    except ImportError:
        print("[WARN] python-dotenv 없음 — env 파일을 읽지 않습니다")
        return
    load_dotenv(env_file, override=False)


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
    _load_env()
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
    )
    results = run_steps(steps, ctx)
    for r in results:
        print(f"[{r.status.upper()}] {r.step} {r.error_code or ''}".rstrip())

    body = build_body(args.request_id, results)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(body, ensure_ascii=True), encoding="ascii")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
