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
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Callable

# scripts/moa-closing(scrape·sms_inbox)은 sys.path 에 있어야 한다 — refresh.py·테스트가 넣는다.
from contract import SMS_CONSUMER, Context, StepFailure, StepResult
from graph import MOA_DIR, XLSX, DriveItem, Graph, GraphError

MOA_URL = "https://moa.jinhakapply.com/Message/CallBack"
MOA_COLS = ["UnivServiceID", "대학명", "모집시기", "모집년도", "CallBack", "파일", "등록일자", "등록상태"]
DROP = {"수정"}  # 버튼 열 — 값이 비어 있어야 한다
WIDTH = {"UnivServiceID": 14, "대학명": 26, "모집시기": 14, "모집년도": 10, "CallBack": 16, "파일": 40, "등록일자": 12, "등록상태": 10}
KST = timezone(timedelta(hours=9))

# 검색 전에 지금 표에 표시를 달고 행을 비운 뒤 검색 칸 셋을 비운다(= 전체).
# 표시가 없어졌거나(쪽을 새로 그림) 행이 다시 생겨야(표를 새로 채움) 검색 결과로 본다 —
# 아니면 검색 전 첫 화면을 두 번 읽고 '안정됐다'며 그것을 저장한다.
# 표가 없으면(로그인 화면으로 튕김) null.
PREP_JS = r"""
var t=document.querySelector('table.tbl.type1'); if(!t) return null;
t.setAttribute('data-srr-stale','1');
[].forEach.call(t.querySelectorAll('tbody tr'),function(tr){tr.parentNode.removeChild(tr);});
['txtServiceID','txtUnivServiceID','txtServiceType'].forEach(function(id){
  var e=document.getElementById(id); if(e) e.value='';});
return true;
"""
SEARCH_JS = "Search();"
ROWS_JS = r"""
var t=document.querySelector('table.tbl.type1'); if(!t) return null;
var h=[].map.call(t.querySelectorAll('th'),x=>x.innerText.trim());
var r=[].map.call(t.querySelectorAll('tbody tr'),tr=>[].map.call(tr.querySelectorAll('td'),td=>td.innerText.trim().replace(/\n/g,' | ')));
return [h,r,t.hasAttribute('data-srr-stale')];
"""
PREV_MIN_RATIO = 0.5  # 지난 파일 행 수의 이 비율 미만이면 덜 읽은 것으로 본다
_A1_ROWS = re.compile(r"(\d+)행\s*$")
_PREV_NAME = re.compile(r"^Moa 등록 리스트_\d{6}(?:_\d+)?\.xlsx$")


def _is_search_result(got) -> bool:
    """검색 뒤 새로 그려진 표인가 — 표시가 사라졌거나 비운 행이 다시 찼다."""
    return got is not None and (not got[2] or len(got[1]) > 0)


def collect_callback_rows(
    driver, *, sleep: Callable[[float], None] = time.sleep, settle_sec: float = 5, tries: int = 8
) -> tuple[list[str], list[list[str]]]:
    """빈 조건으로 검색해 표를 읽는다. 검색 결과 표의 행 수가 두 번 연속 같아야 끝이다.

    검색 전에 표가 없으면(로그인 화면으로 튕김 등) `([], [])` — clean_table 이 moa_empty 로 바꾼다.
    끝까지 안정되지 않으면 **부분 표를 돌려주지 않고** `moa_incomplete` 로 실패한다.
    """
    driver.get(MOA_URL)
    sleep(settle_sec)
    if driver.execute_script(PREP_JS) is None:
        return [], []
    driver.execute_script(SEARCH_JS)
    prev = None
    for _ in range(tries):
        sleep(settle_sec)
        got = driver.execute_script(ROWS_JS)
        if not _is_search_result(got):
            prev = None
            continue
        if prev is not None and len(got[1]) == len(prev[1]):
            head, rows = got[0], got[1]
            return [str(h) for h in head], [[str(c) for c in r] for r in rows]
        prev = got
    raise StepFailure("moa_incomplete", "검색 결과가 끝까지 그려지지 않음")


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
    """드라이버를 띄워 로그인한다 → (driver, SMS 소스 라벨). 로그인 실패면 드라이버를 닫고 올린다.

    내려받기 폴더는 env["download_dir"](요청 작업 폴더 밑 — 폴러가 끝나면 지운다).
    """
    from selenium.webdriver.support.ui import WebDriverWait

    from scrape import login_and_2fa, setup_driver, sms_source_label, sms_urls

    headless = os.getenv("HEADLESS_MODE", "true").lower() == "true"
    Path(env["download_dir"]).mkdir(parents=True, exist_ok=True)
    driver = setup_driver(env["download_dir"], headless)
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


def _prev_rows(graph, items: list[DriveItem]) -> int | None:
    """가장 최근 Moa 등록 리스트의 행 수(A1 '…N행'). 없거나 못 읽으면 None — 비교를 건너뛴다."""
    prev = sorted(
        (i for i in items if _PREV_NAME.match(i.name)), key=lambda i: (i.last_modified, i.name)
    )
    if not prev:
        return None
    data = graph.download(prev[-1].id)
    try:
        from openpyxl import load_workbook

        wb = load_workbook(io.BytesIO(data), read_only=True)
        m = _A1_ROWS.search(str(wb.worksheets[0]["A1"].value or ""))
    except Exception as e:  # noqa: BLE001 — 지난 파일이 깨졌다고 이번 수집을 막지 않는다
        print(f"[WARN] 지난 Moa 목록을 못 읽어 행 수 비교를 건너뜀: {type(e).__name__}")
        return None
    return int(m.group(1)) if m else None


def _check_against_prev(n: int, prev: int | None) -> None:
    if prev is not None and n < prev * PREV_MIN_RATIO:
        raise StepFailure("moa_incomplete", f"지난 파일 {prev}행 → {n}행")


def _teams_state(graph_factory):
    """Graph 연결 + Moa 폴더 목록 + 지난 파일 행 수 — 전부 로그인 전에 끝낸다."""
    try:
        graph = graph_factory()
        items = [i for i in graph.children(MOA_DIR) if i.is_file]
        return graph, [i.name for i in items], _prev_rows(graph, items)
    except GraphError as e:
        raise _graph_failure(e) from None


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
    graph, existing, prev = _teams_state(graph_factory)

    driver, source_label = _login_or_fail(
        login, {**env, "download_dir": str(ctx.work_dir / "moa-download")}
    )
    try:
        header, raw = collect_callback_rows(driver, sleep=sleep)
    finally:
        _quit(driver)

    rows = clean_table(header, raw)
    _check_against_prev(len(rows), prev)
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
