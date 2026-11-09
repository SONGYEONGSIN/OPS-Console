"""② PIMS 발신번호 수집 단계 — PIMS 모니터링 「SMS 번호관리」 목록 전체를 xlsx 한 장으로 Teams 에 저장한다.

저장 위치는 `04. 발신번호 등록 리스트/03. PIMS 등록 리스트/PIMS 등록 리스트_YYMMDD.xlsx`(같은 날
두 번째부터 `_2`, `_3`). 새 파일만 만든다 — 지난 파일은 그대로 둔다(conflictBehavior=fail).
`compare.load_pims` 가 1행을 머리글로 읽으므로 Moa 파일과 달리 추출 안내 행이 없다.

**화면에서 하는 일은 읽기뿐이다.** 처리상태를 '전체'로 바꾸고 조회 함수 하나만 부른다. 승인·반려처럼
상태를 바꾸는 페이지 함수와 그 버튼은 건드리지 않는다(`test_ps_static.py` 가 이 파일 원문에서
그 함수 이름이 없는지 본다). 로그인 버튼은 ID/PW 를 넣고 누르는 것뿐이다.

**저장하지 않고 실패하는 경우**
- 처리상태가 전체로 안 바뀌어 대기(W)만 그려졌다 → 표 행 수가 화면이 들고 있는 원본 건수(`allData`)와
  다르다 → `pims_incomplete`. 표는 멀쩡해 보여서 건수 대조 말고는 알 길이 없다.
- 빈 표(세션 만료·조회 미완료) → `pims_empty`, 열·칸 수가 바뀜 → `pims_shape_changed`.
- 지난 파일의 절반 미만 → `pims_incomplete`. 저장하면 다음 07 대조가 전부 '세종만'으로 바뀐다.

문자 인증·캡차가 없다 — SMS 우편함 리스를 잡지 않는다(Moa 단계와 다르다). 아이디·비밀번호는 Moa 와 같아
env `MOA_USERNAME`/`MOA_PASSWORD` 를 쓴다. 로그인은 **재시도하지 않는다**(틀린 시도가 쌓여 잠기지 않게).
selenium·scrape 는 로그인 함수 안에서 늦게 import 한다 — 테스트가 브라우저 없이 돈다.
결과에는 번호·학교 이름을 싣지 않는다 — 행 수와 상태별 건수만.
"""
from __future__ import annotations

import io
import os
import re
import time
from datetime import date, datetime
from pathlib import Path
from typing import Callable

from compare import PIMS_COLS, load_pims
from contract import Context, StepFailure, StepResult
from graph import PIMS_DIR, XLSX, DriveItem, Graph, GraphError
from moa_collect import _graph_failure, _now_kst, _quit

PIMS_LOGIN_URL = "https://monitoringv2.jinhakapply.com/login.aspx"
PIMS_URL = "https://monitoringv2.jinhakapply.com/PhoneManagement.aspx"
WIDTH = {"UnivID": 10, "대학명": 26, "발신번호": 18, "파일": 40, "등록일자": 20, "상태": 10, "수정": 12, "비고": 30}
PREV_MIN_RATIO = 0.5  # 지난 파일 행 수의 이 비율 미만이면 덜 읽은 것으로 본다
_PREV_NAME = re.compile(r"^PIMS 등록 리스트_\d{6}(?:_\d+)?\.xlsx$")
_SORT_MARKS = re.compile(r"[⇅▲▼↑↓]")
STATUS_KEYS = {"등록완료": "done", "등록대기": "wait", "등록불가": "bad"}

# 조회 전에 지금 표에 표시를 달고 행을 비운다 → 처리상태를 전체('')로 → 대학ID 칸을 비운다.
# 표시가 없어졌거나(표를 새로 그림) 행이 다시 생겨야 조회 결과로 본다 — 아니면 조회 전 화면을
# 두 번 읽고 '안정됐다'며 그것을 저장한다.
# 반환: 표가 없으면(로그인 화면으로 튕김) null · 처리상태 칸이나 전체('') 옵션이 없으면 false
# (표는 건드리지 않는다) · 바꿨으면 true.
PREP_JS = r"""
var t=document.querySelector('table.type1'); if(!t) return null;
var sel=document.getElementById('ProcessType');
if(!sel||![].some.call(sel.options,function(o){return o.value==='';})) return false;
t.setAttribute('data-srr-stale','1');
[].forEach.call(t.tBodies.length?t.tBodies[0].rows:[],function(tr){tr.parentNode.removeChild(tr);});
sel.value='';
var u=document.getElementById('SearchUniv'); if(u) u.value='';
return true;
"""
SEARCH_JS = "getPhoneNumberList(1);"
# 버튼 칸(수정)은 innerText 가 비면 value 를 읽는다. 마지막 값 = 화면이 들고 있는 원본 건수(없으면 null).
ROWS_JS = r"""
var t=document.querySelector('table.type1'); if(!t) return null;
var th=t.tHead?t.tHead.querySelectorAll('th'):t.querySelectorAll('th');
var h=[].map.call(th,x=>x.innerText.trim());
var cell=td=>{var s=td.innerText.trim(); if(!s){var b=td.querySelector('input[value],button'); if(b) s=(b.value||b.innerText||'').trim();} return s.replace(/\s*\n\s*/g,' | ');};
var r=[].map.call(t.tBodies.length?t.tBodies[0].rows:[],tr=>[].map.call(tr.cells,cell));
var n=(typeof allData!=='undefined'&&allData&&allData.length!=null)?allData.length:null;
return [h,r,t.hasAttribute('data-srr-stale'),n];
"""


def _is_search_result(got) -> bool:
    """조회 뒤 새로 그려진 표인가 — 표시가 사라졌거나 비운 행이 다시 찼다."""
    return got is not None and (not got[2] or len(got[1]) > 0)


def collect_pims_rows(
    driver, *, sleep: Callable[[float], None] = time.sleep, settle_sec: float = 3, tries: int = 8
) -> tuple[list[str], list[list[str]], int]:
    """처리상태를 전체로 바꿔 조회하고 표를 읽는다 → (머리글, 행, 원본 건수).

    표 행 수가 두 번 연속 같아야 끝이다. 표가 없으면(로그인 화면으로 튕김 등) `([], [], 0)` —
    clean_pims_table 이 pims_empty 로 바꾼다. 끝까지 안정되지 않으면 **부분 표를 돌려주지 않고**
    `pims_incomplete`. 원본 건수를 못 읽으면(화면이 바뀜) 0 으로 돌려 행 수 대조에서 걸린다.
    """
    driver.get(PIMS_URL)
    sleep(settle_sec)
    prepared = driver.execute_script(PREP_JS)
    if prepared is None:
        return [], [], 0
    if prepared is not True:
        # 전체로 못 바꾸면 대기(W)만 읽는다 — 빈 표와 구분해 화면 구조 변경으로 알린다.
        raise StepFailure("pims_shape_changed", "처리상태 칸")
    driver.execute_script(SEARCH_JS)
    prev = None
    for _ in range(tries):
        sleep(settle_sec)
        got = driver.execute_script(ROWS_JS)
        if not _is_search_result(got):
            prev = None
            continue
        if prev is not None and len(got[1]) == len(prev[1]):
            head, rows, _stale, count = got
            return [str(h) for h in head], [[str(c) for c in r] for r in rows], int(count or 0)
        prev = got
    raise StepFailure("pims_incomplete", "조회 결과가 끝까지 그려지지 않음")


def clean_pims_table(header: list[str], rows: list[list[str]], all_count: int) -> list[list[str]]:
    """머리글의 정렬 기호를 떼고 모양을 확인한다. 칸 값은 strip 한 화면 텍스트 그대로다."""
    # '조회 결과 없음' 한 칸짜리 행만 있으면 빈 표다.
    if not rows or all(len(r) <= 1 for r in rows):
        raise StepFailure("pims_empty")
    head = [_SORT_MARKS.sub("", h).strip() for h in header]
    if head != PIMS_COLS:
        raise StepFailure("pims_shape_changed", "머리글")
    if any(len(r) != len(head) for r in rows):
        raise StepFailure("pims_shape_changed", "행 칸 수")
    if len(rows) != all_count:
        raise StepFailure("pims_incomplete", f"표 {len(rows)}행 · 원본 {all_count}행")
    return [[c.strip() for c in r] for r in rows]


def build_pims_xlsx(rows: list[list[str]]) -> bytes:
    """1행 = 머리글. 값은 전부 텍스트 칸(`@`) — 대학 ID·번호가 숫자로 바뀌면 앞자리 0·하이픈이 사라진다."""
    from openpyxl import Workbook
    from openpyxl.styles import Font
    from openpyxl.utils import get_column_letter

    wb = Workbook()
    ws = wb.active
    ws.title = "PIMS 등록 리스트"
    ws.append(PIMS_COLS)
    for c in ws[1]:
        c.font = Font(bold=True)
    for r in rows:
        ws.append([str(v) for v in r])
    for line in ws.iter_rows(min_row=2, max_col=len(PIMS_COLS)):
        for c in line:
            c.number_format = "@"
    for i, h in enumerate(PIMS_COLS, 1):
        ws.column_dimensions[get_column_letter(i)].width = WIDTH.get(h, 14)
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(PIMS_COLS))}{len(rows) + 1}"
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def next_pims_name(existing: list[str], today: date) -> str:
    base = f"PIMS 등록 리스트_{today:%y%m%d}"
    pat = re.compile(rf"^{re.escape(base)}(?:_(\d+))?\.xlsx$")
    taken = [int(m.group(1) or 1) for m in (pat.match(n) for n in existing) if m]
    return f"{base}.xlsx" if not taken else f"{base}_{max(taken) + 1}.xlsx"


def _pims_env() -> dict:
    return {
        "username": os.getenv("MOA_USERNAME", ""),
        "password": os.getenv("MOA_PASSWORD", ""),
    }


def _login(env: dict):
    """드라이버를 띄워 로그인한다 → driver. 실패하면 드라이버를 닫고 올린다. 재시도하지 않는다.

    내려받기 폴더는 env["download_dir"](요청 작업 폴더 밑 — 폴러가 끝나면 지운다).
    성공 판정: 주소가 `/Default.aspx` 로 바뀌고 `#AdminId` 가 사라진다.
    """
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.support.ui import WebDriverWait

    from scrape import setup_driver

    headless = os.getenv("HEADLESS_MODE", "true").lower() == "true"
    Path(env["download_dir"]).mkdir(parents=True, exist_ok=True)
    driver = setup_driver(env["download_dir"], headless)
    try:
        wait = WebDriverWait(driver, int(os.getenv("MOA_WAIT_SEC", "40")))
        driver.get(PIMS_LOGIN_URL)
        wait.until(EC.presence_of_element_located((By.ID, "AdminId")))
        driver.find_element(By.ID, "AdminId").send_keys(env["username"])
        driver.find_element(By.ID, "AdminPassWord").send_keys(env["password"])
        driver.find_element(By.CSS_SELECTOR, "a.btn.blue").click()
        wait.until(
            lambda d: "/default.aspx" in d.current_url.lower() and not d.find_elements(By.ID, "AdminId")
        )
    except BaseException:
        _quit(driver)
        raise
    return driver


def _login_or_fail(login, env: dict):
    try:
        return login(env)
    except Exception as e:  # noqa: BLE001 — 메시지는 싣지 않는다
        raise StepFailure("pims_login_failed", type(e).__name__) from None


def _prev_rows(graph, items: list[DriveItem]) -> int | None:
    """가장 최근 PIMS 등록 리스트의 데이터 행 수(머리글 제외). 없거나 못 읽으면 None — 비교를 건너뛴다."""
    prev = sorted(
        (i for i in items if _PREV_NAME.match(i.name)), key=lambda i: (i.last_modified, i.name)
    )
    if not prev:
        return None
    data = graph.download(prev[-1].id)
    try:
        return len(load_pims(data))
    except Exception as e:  # noqa: BLE001 — 지난 파일이 깨졌다고 이번 수집을 막지 않는다
        print(f"[WARN] 지난 PIMS 목록을 못 읽어 행 수 비교를 건너뜀: {type(e).__name__}")
        return None


def _check_against_prev(n: int, prev: int | None) -> None:
    if prev is not None and n < prev * PREV_MIN_RATIO:
        raise StepFailure("pims_incomplete", f"지난 파일 {prev}행 → {n}행")


def _teams_state(graph_factory):
    """Graph 연결 + PIMS 폴더 목록 + 지난 파일 행 수 — 전부 로그인 전에 끝낸다."""
    try:
        graph = graph_factory()
        items = [i for i in graph.children(PIMS_DIR) if i.is_file]
        return graph, [i.name for i in items], _prev_rows(graph, items)
    except GraphError as e:
        raise _graph_failure(e) from None


def _status_counts(rows: list[list[str]]) -> dict[str, int]:
    status = [r[PIMS_COLS.index("상태")] for r in rows]
    return {"rows": len(rows), **{key: status.count(label) for label, key in STATUS_KEYS.items()}}


def run_pims_step(
    ctx: Context,
    *,
    login=_login,
    graph_factory=Graph.from_env,
    now: Callable[[], datetime] = _now_kst,
    sleep: Callable[[float], None] = time.sleep,
) -> StepResult:
    env = _pims_env()
    if not env["username"] or not env["password"]:
        raise StepFailure("pims_login_failed", "MOA 계정 env 누락")

    # Teams 쪽을 먼저 본다 — 로그인한 뒤에 저장할 곳이 없다는 걸 알면 헛수고다.
    graph, existing, prev = _teams_state(graph_factory)

    driver = _login_or_fail(login, {**env, "download_dir": str(ctx.work_dir / "pims-download")})
    try:
        header, raw, all_count = collect_pims_rows(driver, sleep=sleep)
    finally:
        _quit(driver)

    rows = clean_pims_table(header, raw, all_count)
    _check_against_prev(len(rows), prev)
    name = next_pims_name(existing, now().date())
    data = build_pims_xlsx(rows)  # 시험 실행도 만든다 — 만드는 데서 깨지는지까지 본다
    counts = _status_counts(rows)
    if ctx.dry_run:
        return StepResult("pims", "ok", f"PIMS 목록 {len(rows)}행 · 저장 안 함(시험 실행)", counts=counts)
    try:
        graph.put_new(PIMS_DIR, name, data, XLSX)
    except GraphError as e:
        raise _graph_failure(e) from None
    changes = () if prev is None else (f"PIMS: 지난 {prev}행 → {len(rows)}행",)
    return StepResult("pims", "ok", f"PIMS 목록 {len(rows)}행 저장 ({name})", counts=counts, changes=changes)
