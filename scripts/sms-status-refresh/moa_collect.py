"""② Moa 발신번호 수집 단계 — Moa 「알림톡 > 발신번호 관리」 목록 전체를 xlsx 한 장으로 Teams 에 저장한다.

저장 위치는 `04. 발신번호 등록 리스트/02. Moa 등록 리스트/Moa 등록 리스트_YYMMDD.xlsx`(같은 날
두 번째부터 `_2`, `_3`). 새 파일만 만든다 — 지난 파일은 그대로 둔다(conflictBehavior=fail).

**저장하지 않고 실패하는 경우** — 빈 표(세션 만료·검색 미완료)는 `moa_empty`, 열이 바뀌었거나
`수정` 열에 값이 있으면 `moa_shape_changed`. 그런 목록을 저장하면 다음 06 대조가 전부
'세종만'으로 바뀐다.

**`SetCallBackUpdate` 는 부르지 않는다** — 그 화면의 수정 함수다. 빈 조건 `Search();` 로 읽기만 한다.

Moa 로그인은 `scripts/moa-closing/scrape.py` 를 그대로 쓴다(2FA 가 두 벌이 되지 않게).
selenium·scrape 는 로그인 함수 안에서 늦게 import 한다 — 테스트가 브라우저 없이 돈다.
결과에는 번호·학교 이름을 싣지 않는다 — 행 수·고유 수만.
"""
from __future__ import annotations

import io
import os
import re
import sys
import tempfile
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Callable

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "moa-closing"))

from contract import SMS_CONSUMER, Context, StepFailure, StepResult  # noqa: E402
from graph import MOA_DIR, XLSX, Graph, GraphError  # noqa: E402

MOA_URL = "https://moa.jinhakapply.com/Message/CallBack"
MOA_COLS = ["UnivServiceID", "대학명", "모집시기", "모집년도", "CallBack", "파일", "등록일자", "등록상태"]
DROP = {"수정"}  # 버튼 열 — 값이 비어 있어야 한다
WIDTH = {"UnivServiceID": 14, "대학명": 26, "모집시기": 14, "모집년도": 10, "CallBack": 16, "파일": 40, "등록일자": 12, "등록상태": 10}
KST = timezone(timedelta(hours=9))

# 검색 칸 셋을 비운다(= 전체). 칸이 없으면 건너뛴다.
CLEAR_JS = (
    "['txtServiceID','txtUnivServiceID','txtServiceType'].forEach(function(id){"
    "var e=document.getElementById(id); if(e) e.value='';});"
)
SEARCH_JS = "Search();"
ROWS_JS = r"""
var t=document.querySelector('table.tbl.type1'); if(!t) return null;
var h=[].map.call(t.querySelectorAll('th'),x=>x.innerText.trim());
var r=[].map.call(t.querySelectorAll('tbody tr'),tr=>[].map.call(tr.querySelectorAll('td'),td=>td.innerText.trim().replace(/\n/g,' | ')));
return [h,r];
"""


def collect_callback_rows(
    driver, *, sleep: Callable[[float], None] = time.sleep, settle_sec: float = 5, tries: int = 6
) -> tuple[list[str], list[list[str]]]:
    """빈 조건으로 검색해 표를 읽는다. 행 수가 두 번 연속 같으면 다 그려진 것으로 본다.

    표가 없으면(로그인 화면으로 튕김 등) `([], [])` — clean_table 이 moa_empty 로 바꾼다.
    """
    driver.get(MOA_URL)
    sleep(settle_sec)
    driver.execute_script(CLEAR_JS)
    driver.execute_script(SEARCH_JS)
    prev = None
    for _ in range(tries):
        sleep(settle_sec)
        got = driver.execute_script(ROWS_JS)
        if got is not None and prev is not None and len(got[1]) == len(prev[1]):
            prev = got
            break
        prev = got
    if prev is None:
        return [], []
    head, rows = prev
    return [str(h) for h in head], [[str(c) for c in r] for r in rows]


def clean_table(header: list[str], rows: list[list[str]]) -> list[list[str]]:
    """머리글의 ' ⇅' 를 떼고 빈 `수정` 열을 뺀다. 모양이 다르면 저장하지 않게 실패한다."""
    # '검색 결과 없음' 한 칸짜리 행만 있으면 빈 표다.
    if not rows or all(len(r) <= 1 for r in rows):
        raise StepFailure("moa_empty")
    head = [h.replace("⇅", "").strip() for h in header]
    if any(len(r) != len(head) for r in rows):
        raise StepFailure("moa_shape_changed", "행 칸 수")
    drop = {i for i, h in enumerate(head) if h in DROP}
    if any(r[i].strip() for r in rows for i in drop):
        raise StepFailure("moa_shape_changed", "수정 열")
    keep = [i for i in range(len(head)) if i not in drop]
    if [head[i] for i in keep] != MOA_COLS:
        raise StepFailure("moa_shape_changed", "머리글")
    return [[r[i] for i in keep] for r in rows]


def build_moa_xlsx(rows: list[list[str]], extracted_at: datetime) -> bytes:
    """값은 전부 텍스트 칸(`@`) — 서비스ID·번호가 숫자로 바뀌면 앞자리 0·하이픈이 사라진다."""
    from openpyxl import Workbook
    from openpyxl.styles import Font
    from openpyxl.utils import get_column_letter

    wb = Workbook()
    ws = wb.active
    ws.title = f"Moa 등록 리스트_{extracted_at:%y%m%d}"
    ws.append([f"추출: {extracted_at:%Y-%m-%d %H:%M} Moa 「알림톡 > 발신번호 관리」(/Message/CallBack), {len(rows)}행"])
    ws["A1"].font = Font(bold=True)
    ws.append(MOA_COLS)
    for c in ws[2]:
        c.font = Font(bold=True)
    for r in rows:
        ws.append([str(v) for v in r])
    for line in ws.iter_rows(min_row=3, max_col=len(MOA_COLS)):
        for c in line:
            c.number_format = "@"
    for i, h in enumerate(MOA_COLS, 1):
        ws.column_dimensions[get_column_letter(i)].width = WIDTH.get(h, 14)
    ws.freeze_panes = "A3"
    ws.auto_filter.ref = f"A2:{get_column_letter(len(MOA_COLS))}{len(rows) + 2}"
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def next_moa_name(existing: list[str], today: date) -> str:
    base = f"Moa 등록 리스트_{today:%y%m%d}"
    pat = re.compile(rf"^{re.escape(base)}(?:_(\d+))?\.xlsx$")
    taken = [int(m.group(1) or 1) for m in (pat.match(n) for n in existing) if m]
    return f"{base}.xlsx" if not taken else f"{base}_{max(taken) + 1}.xlsx"


def _now_kst() -> datetime:
    return datetime.now(KST)


def _moa_env() -> dict:
    """discover.py 와 같은 모양 + 우편함 창구 키. sms_urls 는 로그인 함수가 채운다(scrape 필요)."""
    return {
        "username": os.getenv("MOA_USERNAME", ""),
        "password": os.getenv("MOA_PASSWORD", ""),
        "sms_timeout": int(os.getenv("MOA_SMS_POLL_TIMEOUT_SEC", "90")),
        "sms_interval": int(os.getenv("MOA_SMS_POLL_INTERVAL_SEC", "3")),
        "base_url": os.getenv("OPS_CONSOLE_BASE_URL", "").rstrip("/"),
        "secret": os.getenv("CRON_SECRET", ""),
        "sms_consumer": SMS_CONSUMER,
    }


def _login(env: dict):
    """드라이버를 띄워 로그인한다 → (driver, SMS 소스 라벨). 로그인 실패면 드라이버를 닫고 올린다."""
    from selenium.webdriver.support.ui import WebDriverWait

    from scrape import login_and_2fa, setup_driver, sms_source_label, sms_urls

    headless = os.getenv("HEADLESS_MODE", "true").lower() == "true"
    driver = setup_driver(tempfile.mkdtemp(prefix="moa-callback-"), headless)
    try:
        wait = WebDriverWait(driver, int(os.getenv("MOA_WAIT_SEC", "40")))
        source = login_and_2fa(driver, wait, {**env, "sms_urls": sms_urls()})
    except BaseException:
        _quit(driver)
        raise
    return driver, sms_source_label(source)


def _quit(driver) -> None:
    try:
        driver.quit()
    except Exception:  # noqa: BLE001 — 닫기 실패가 결과를 가리지 않게
        print("[WARN] 드라이버 닫기 실패")


def _graph_failure(e: GraphError) -> StepFailure:
    return StepFailure("source_missing" if e.status == 404 else "unknown", f"GraphError {e.status}")


def _login_or_fail(login, env: dict):
    from sms_inbox import LeaseHeldError

    try:
        return login(env)
    except LeaseHeldError:
        # 폴백하지 않는다 — SMS 두 통이 한 폰에 겹치면 서로의 코드를 가져간다.
        raise StepFailure("lease_busy") from None
    except Exception as e:  # noqa: BLE001 — 메시지는 싣지 않는다
        raise StepFailure("login_failed", type(e).__name__) from None


def run_moa_step(
    ctx: Context,
    *,
    login=_login,
    graph_factory=Graph.from_env,
    now: Callable[[], datetime] = _now_kst,
    sleep: Callable[[float], None] = time.sleep,
) -> StepResult:
    env = _moa_env()
    if not env["username"] or not env["password"]:
        raise StepFailure("login_failed", "MOA 계정 env 누락")

    # Teams 쪽을 먼저 본다 — 인증 문자를 보낸 뒤에 저장할 곳이 없다는 걸 알면 문자 한 통이 헛된다.
    try:
        graph = graph_factory()
        existing = [i.name for i in graph.children(MOA_DIR) if i.is_file]
    except GraphError as e:
        raise _graph_failure(e) from None

    driver, source_label = _login_or_fail(login, env)
    try:
        header, raw = collect_callback_rows(driver, sleep=sleep)
    finally:
        _quit(driver)

    rows = clean_table(header, raw)
    at = now()
    name = next_moa_name(existing, at.date())
    data = build_moa_xlsx(rows, at)  # 시험 실행도 만든다 — 만드는 데서 깨지는지까지 본다
    if ctx.dry_run:
        saved = f"{name} 저장 안 함(시험 실행)"
    else:
        try:
            graph.put_new(MOA_DIR, name, data, XLSX)
        except GraphError as e:
            raise _graph_failure(e) from None
        saved = f"{name} 저장"

    return StepResult(
        "moa",
        "ok",
        f"Moa {len(rows)}행 수집 · {saved} (SMS: {source_label})",
        counts={
            "rows": len(rows),
            "services": len({r[0] for r in rows}),
            "univs": len({r[0][:4] for r in rows}),
        },
    )
