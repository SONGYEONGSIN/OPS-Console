#!/usr/bin/env python3
"""주간보고 개발 구분 수집기 — Moa 작업진행현황 → OPS-Console /api/ops-weekly/dev-status.

회사 PC 작업 스케줄러(`OPS-Console-Ops-Weekly-Dev-Status`, 수요일 09:30)가 부른다.
흐름: env 확인 → 서버 준비 확인(dry-run 은 건너뜀) → Moa 로그인(409 면 기다렸다 최대 3회) → 페이지 안에서 $.ajax 조회
→ 직렬화 확인 → 파싱(칸 모양이 다르면 아무것도 안 보낸다) → 인제스트 → 실행 기록.

응답 HTML 에는 운영자·개발자 이름이 들어 있다 — 출력·저장하지 않는다. 로그인 뒤의
예상 밖 예외는 타입 이름만 보고한다. 설계: docs/superpowers/specs/2026-11-17-ops-weekly-a4-dev-status-design.md

env:
  OPS_WEEKLY_DEV_STATUS_DRY_RUN=true   로그인·조회·파싱까지만(인증 문자는 간다), 인제스트·실행 기록 없음
"""
from __future__ import annotations

import calendar
import os
import sys
import tempfile
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Mapping
from urllib.parse import parse_qs

import requests

# `python -I` 는 스크립트 폴더를 sys.path 에 넣지 않는다 — 자기 폴더와 Moa 로그인 모듈 폴더를 직접 넣는다.
_HERE = Path(__file__).resolve().parent
_REPO_ROOT = _HERE.parent.parent
for _p in (_HERE.parent / "moa-closing", _HERE):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from parse import DevStatusFailure, parse_work_status  # noqa: E402

# 우편함 점유 이름 — 서버 zod enum(SMS_CONSUMERS)과 짝이다. env 로 덮어쓸 수 없다(dev-status-drift.test.ts).
SMS_CONSUMER = "ops-weekly-dev-status"
TASK_NAME = "OPS-Console-Ops-Weekly-Dev-Status"
WORK_STATUS_URL = "https://moa.jinhakapply.com/Develop/WorkStatus"
LEASE_ATTEMPTS = 3
LEASE_WAIT_SEC = 240  # 리스 TTL 180초보다 길게 — 다음 시도 때는 앞선 점유가 풀려 있다
DRY_RUN_ENV = "OPS_WEEKLY_DEV_STATUS_DRY_RUN"

# 구분을 읽는 것은 시작 전 서비스다. 늘 6개월 앞까지 보면 2월에도 3월 오픈이 범위 안이라
# 계절 구멍이 없고, 범위가 가장 넓은 2월(학년도 시작 ~ 8월)에도 인제스트 상한 5,000행 안이다.
RANGE_AHEAD_MONTHS = 6
SCRIPT_TIMEOUT_SEC = 120  # 1.33MB 응답(세션 4)도 수 초 — 넉넉히
_KST = timezone(timedelta(hours=9))
_BLANK_KEYS = ("Manager", "Developer", "CategoryName")

READY_JS = "return !!(window.jQuery && document.getElementById('form0'));"
FILL_JS = """
const [start, end] = arguments;
const set = (id, v) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = v;
  el.dispatchEvent(new Event('input', {bubbles: true}));
  el.dispatchEvent(new Event('change', {bubbles: true}));
};
['ddlManager', 'ddlDeveloper', 'ddlCategoryName',
 'txtUnivServiceID', 'txtServiceType', 'txtServiceName'].forEach(id => set(id, ''));
set('txtApplyFromTime', start);
set('txtApplyToTime', end);
"""
SERIALIZE_JS = "return $('#form0').serialize();"
AJAX_JS = """
const done = arguments[arguments.length - 1];
$.ajax({url:'/Develop/WorkStatus',type:'POST',data:$('#form0').serialize(),headers:{'X-Requested-With':'XMLHttpRequest'}})
  .done((b,_,x)=>done({status:x.status, body:b}))
  .fail(x=>done({status:x.status, body:""}));
"""


def add_months_clamped(d: date, months: int) -> date:
    """months 개월 뒤 같은 날. 그 달에 없는 날이면 그 달 말일."""
    y, m0 = divmod(d.year * 12 + d.month - 1 + months, 12)
    m = m0 + 1
    return date(y, m, min(d.day, calendar.monthrange(y, m)[1]))


def collect_range(now: datetime) -> tuple[str, str]:
    """(올 학년도 시작, KST 오늘 + RANGE_AHEAD_MONTHS) — 둘 다 YYYY-MM-DD."""
    from scrape import academic_year_range

    start = academic_year_range(now)["start"]["date"]
    end = add_months_clamped(now.astimezone(_KST).date(), RANGE_AHEAD_MONTHS)
    return start, end.isoformat()


def build_env(environ: Mapping[str, str]) -> dict:
    """마감 스크랩과 같은 env 이름. sms_consumer 는 언제나 SMS_CONSUMER 다."""
    from scrape import sms_urls

    temp = environ.get("TEMP") or tempfile.gettempdir()
    return {
        "username": environ.get("MOA_USERNAME", ""),
        "password": environ.get("MOA_PASSWORD", ""),
        "sms_urls": sms_urls(environ),
        "sms_timeout": int(environ.get("MOA_SMS_POLL_TIMEOUT_SEC", "90")),
        "sms_interval": int(environ.get("MOA_SMS_POLL_INTERVAL_SEC", "3")),
        "wait_sec": int(environ.get("MOA_WAIT_SEC", "40")),
        "base_url": environ.get("OPS_CONSOLE_BASE_URL", "").rstrip("/"),
        "secret": environ.get("CRON_SECRET", ""),
        "sms_consumer": SMS_CONSUMER,
        "download_dir": str(Path(temp) / "moa-dev-status"),
    }


def check_serialized(serialized: str, start: str, end: str) -> None:
    """보내기 전 폼 확인 — 값 넣기가 조용히 실패하면 기본값(본인·수시)으로 15행만 온다.

    날짜 키 이름은 정찰로 확인했다(ApplyFromTime·ApplyToTime). 이유에는 키 이름만 싣는다.
    """
    qs = parse_qs(serialized, keep_blank_values=True)
    for key in _BLANK_KEYS:
        if key not in qs:
            raise DevStatusFailure("form_not_set", f"{key} 키 없음")
        if any(v != "" for v in qs[key]):
            raise DevStatusFailure("form_not_set", f"{key} 값이 남아 있음")
    for key, want in (("ApplyFromTime", start), ("ApplyToTime", end)):
        if key not in qs:
            raise DevStatusFailure("form_not_set", f"{key} 키 없음")
        if qs[key] != [want]:
            raise DevStatusFailure("form_not_set", f"{key} 값이 다름")


def _wait_form(driver, wait_sec: int) -> None:
    deadline = time.monotonic() + wait_sec
    while not driver.execute_script(READY_JS):
        if time.monotonic() >= deadline:
            raise DevStatusFailure("fetch_failed", "#form0 이 열리지 않음")
        time.sleep(0.5)


def _query(driver, start: str, end: str, wait_sec: int):
    driver.get(WORK_STATUS_URL)
    _wait_form(driver, wait_sec)
    driver.execute_script(FILL_JS, start, end)
    check_serialized(driver.execute_script(SERIALIZE_JS) or "", start, end)
    driver.set_script_timeout(SCRIPT_TIMEOUT_SEC)
    return driver.execute_async_script(AJAX_JS) or {}


def fetch_work_status(driver, start: str, end: str, wait_sec: int) -> str:
    """로그인한 페이지 안에서 작업진행현황을 조회해 본문 HTML 을 돌려준다(브라우저 밖 POST 는 IIS 403).

    selenium 오류(스크립트 타임아웃 포함)는 fetch_failed 로 — 메시지는 싣지 않는다.
    """
    from selenium.common.exceptions import WebDriverException

    try:
        got = _query(driver, start, end, wait_sec)
    except WebDriverException as e:
        raise DevStatusFailure("fetch_failed", type(e).__name__) from None
    status = got.get("status")
    if status != 200:
        raise DevStatusFailure("fetch_failed", f"HTTP {status}")
    body = got.get("body")
    if not isinstance(body, str):
        raise DevStatusFailure("fetch_failed", "본문이 문자열이 아님")
    return body


def _quit(driver) -> None:
    try:
        driver.quit()
    except Exception:  # noqa: BLE001 — 닫기 실패가 결과를 가리지 않게
        print("[WARN] 드라이버 닫기 실패")


def _login(env: dict) -> tuple[object, str]:
    """드라이버를 띄워 로그인한다 → (driver, SMS 소스 라벨). 실패하면 드라이버를 닫고 올린다."""
    from selenium.webdriver.support.ui import WebDriverWait

    from scrape import login_and_2fa, setup_driver, sms_source_label

    headless = os.getenv("HEADLESS_MODE", "true").lower() == "true"
    Path(env["download_dir"]).mkdir(parents=True, exist_ok=True)
    driver = setup_driver(env["download_dir"], headless)
    try:
        source = login_and_2fa(driver, WebDriverWait(driver, env["wait_sec"]), env)
    except BaseException:
        _quit(driver)
        raise
    return driver, sms_source_label(source)


def login_with_retry(env: dict, *, login=_login, sleep=time.sleep) -> tuple[object, str]:
    """409(다른 소비자가 로그인 점유)만 기다렸다 처음부터 다시 한다 — 아직 아무것도 제출하지 않았다.

    다른 로그인 실패는 다시 하지 않는다(반복 실패는 계정 잠금으로 이어진다).
    """
    from sms_inbox import LeaseHeldError

    for attempt in range(1, LEASE_ATTEMPTS + 1):
        try:
            return login(env)
        except LeaseHeldError as e:
            if attempt == LEASE_ATTEMPTS:
                raise DevStatusFailure("lease_busy", f"점유자 {e.holder}") from None
            print(f"[WARN] 로그인 점유 중({e.holder}) — {LEASE_WAIT_SEC}초 뒤 다시 ({attempt}/{LEASE_ATTEMPTS})")
            sleep(LEASE_WAIT_SEC)
        except Exception as e:  # noqa: BLE001 — 로그인 전 단계 문구라 셀 내용이 없다
            first = (str(e).splitlines() or [""])[0]
            raise DevStatusFailure("login_failed", f"{type(e).__name__}: {first}"[:300]) from None
    raise AssertionError("unreachable")


def _auth(secret: str) -> dict:
    return {"Authorization": f"Bearer {secret}"}


def preflight(base_url: str, secret: str, *, http=requests) -> None:
    """로그인 전 서버 준비 확인 — 빈 본문에 400 JSON {ok:false} 면 라우트·인증이 살아 있다(같은 배포의 소비자 이름도).

    배포 전에 돌면 옛 서버가 새 소비자 이름을 400 으로 거절해 make 로 넘어가 문자를 쓰고,
    인제스트·실행 기록도 307 이라 아무 데도 안 남는다. 그 전에 멈춘다.
    """
    try:
        resp = http.post(
            f"{base_url.rstrip('/')}/api/ops-weekly/dev-status",
            json={},
            headers=_auth(secret),
            timeout=30,
            allow_redirects=False,
        )
    except requests.RequestException as e:
        raise DevStatusFailure("server_not_ready", type(e).__name__) from None
    status = resp.status_code
    try:
        data = resp.json() if status == 400 else None
    except ValueError:
        data = None
    if not (isinstance(data, dict) and data.get("ok") is False):
        raise DevStatusFailure("server_not_ready", f"HTTP {status}")


def stage_counts(rows: list[tuple[int, str, str]]) -> dict[str, int]:
    """서버 판정과 같은 규칙 — 리얼배포가 있으면 배포, 아니면 테스트 오픈이 있으면 테스트, 둘 다 없으면 개발."""
    deployed = sum(1 for _, _, r in rows if r != "-")
    test = sum(1 for _, t, r in rows if r == "-" and t != "-")
    return {"test": test, "dev": len(rows) - deployed - test, "deployed": deployed}


def post_ingest(
    base_url: str, secret: str, rows: list[tuple[int, str, str]], *, http=requests
) -> dict:
    """한 번에 보낸다. 리다이렉트(PUBLIC_PATHS 누락 → /login HTML)를 성공으로 읽지 않게 ok 를 본다."""
    try:
        resp = http.post(
            f"{base_url.rstrip('/')}/api/ops-weekly/dev-status",
            json={
                "rows": [
                    {"service_id": sid, "test_open": t, "real_deploy": r} for sid, t, r in rows
                ]
            },
            headers=_auth(secret),
            timeout=30,
            allow_redirects=False,
        )
    except requests.RequestException as e:
        raise DevStatusFailure("ingest_failed", type(e).__name__) from None
    status = resp.status_code
    if status != 200:
        raise DevStatusFailure("ingest_failed", f"HTTP {status}")
    try:
        data = resp.json()
    except ValueError:
        raise DevStatusFailure("ingest_failed", f"HTTP {status}") from None
    if not isinstance(data, dict) or data.get("ok") is not True:
        raise DevStatusFailure("ingest_failed", f"HTTP {status}")
    return data


def post_run_log(base_url: str, secret: str, status: str, message: str, *, http=requests) -> None:
    """실행 기록 — best-effort. 실패해도 수집 결과를 바꾸지 않는다."""
    try:
        resp = http.post(
            f"{base_url.rstrip('/')}/api/ops-weekly/dev-status/run-log",
            json={"status": status, "message": message[:1000]},
            headers=_auth(secret),
            timeout=30,
            allow_redirects=False,
        )
        if resp.status_code != 200:
            print(f"[WARN] 실행 기록 응답 HTTP {resp.status_code}")
    except Exception as e:  # noqa: BLE001
        print(f"[WARN] 실행 기록 실패: {type(e).__name__}")


def success_message(resp: dict, start: str, end: str, sms_label: str) -> str:
    return (
        f"수집 {resp['received']:,}건 — 테스트 {resp['test']:,} · 개발 {resp['dev']:,} "
        f"· 배포 {resp['deployed']:,} · 범위 {start}~{end} (SMS: {sms_label})"
    )


def failure_message(code: str, reason: str) -> str:
    return f"{code}: {reason} — 재실행: Start-ScheduledTask -TaskName '{TASK_NAME}'"


def run(
    env: dict,
    *,
    now: datetime,
    dry_run: bool,
    login=_login,
    fetch=fetch_work_status,
    http=requests,
    sleep=time.sleep,
) -> int:
    base_url, secret = env.get("base_url", ""), env.get("secret", "")

    def fail(code: str, reason: str) -> int:
        print(f"[FAIL] {code}: {reason}")
        if not dry_run:
            post_run_log(base_url, secret, "failed", failure_message(code, reason), http=http)
        return 1

    # sms_urls 는 늘 필수 — 우편함이 죽었을 때 폴백이 있는지 시작 전에 알아야 한다(마감과 같다).
    missing = [k for k in ("username", "password", "sms_urls") if not env.get(k)]
    if not dry_run:
        missing += [k for k in ("base_url", "secret") if not env.get(k)]
    if missing:
        return fail("env_missing", f"환경변수 누락 {missing}")
    if not dry_run:
        try:
            preflight(base_url, secret, http=http)
        except DevStatusFailure as e:
            return fail(e.code, e.reason)

    start, end = collect_range(now)
    print(f"[INFO] 범위 {start} ~ {end}")
    try:
        driver, sms_label = login_with_retry(env, login=login, sleep=sleep)
        try:
            html = fetch(driver, start, end, env["wait_sec"])
        finally:
            _quit(driver)
        rows = parse_work_status(html)
        del html
        n = stage_counts(rows)
        print(
            f"[INFO] 행 {len(rows):,}건 "
            f"(테스트 {n['test']:,} · 개발 {n['dev']:,} · 배포 {n['deployed']:,})"
        )
        if dry_run:
            print("[DRY-RUN] 인제스트·실행 기록 미전송")
            return 0
        message = success_message(post_ingest(base_url, secret, rows, http=http), start, end, sms_label)
    except DevStatusFailure as e:
        return fail(e.code, e.reason)
    except Exception as e:  # noqa: BLE001 — 로그인 뒤라 메시지에 셀 내용이 있을 수 있다
        return fail("unexpected", type(e).__name__)

    post_run_log(base_url, secret, "success", message, http=http)
    print(f"[OK] {message}")
    return 0


def main() -> int:
    try:
        from dotenv import load_dotenv

        load_dotenv(_REPO_ROOT / ".env.local", override=False)
    except Exception:  # noqa: BLE001 — 없으면 env_missing 이 잡는다
        pass
    env = build_env(os.environ)
    # 로그인 실패 덤프(fail-login.*)가 스케줄러 작업 폴더(레포 루트)에 떨어지지 않게
    os.environ.setdefault("CLOSING_DUMP_DIR", env["download_dir"])
    return run(
        env,
        now=datetime.now(timezone.utc),
        dry_run=os.getenv(DRY_RUN_ENV, "").lower() == "true",
    )


if __name__ == "__main__":
    sys.exit(main())
