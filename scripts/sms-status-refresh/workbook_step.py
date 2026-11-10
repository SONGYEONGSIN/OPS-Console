"""④ 현황 파일 단계 — 「06. Moa 대조」·「07. PIMS 대조」를 다시 써서 Teams 의 현황 xlsm 에 올린다.

순서는 고정이다(남의 저장을 조용히 덮지 않는 것이 이 단계의 일):
1. 현황 파일을 고르고 **eTag 를 먼저 기록**한 뒤 내려받는다 — 내려받은 뒤 eTag 를 읽으면
   그 사이 저장된 것을 원본으로 착각한다.
2. 세종·Moa·PIMS 의 그 시점 최신 목록으로 06·07 을 계산한다(앞 단계가 실패해도 지난 목록으로 돈다).
3. Excel COM 으로 작업 사본에 쓰고 → 매크로 바이트 복원 → 검사. **하나라도 실패면 올리지 않는다.**
4. 올리기 직전 eTag 를 다시 보고, 같을 때만 처음 eTag 로 If-Match 업로드.
5. 올린 뒤 행 수로 확인한다 — 앱 시트(_학교 등)는 그대로, 06·07 은 쓴 만큼.

xlsm 은 openpyxl 로 **읽기만** 한다. 작업 파일(번호가 든 xlsm·data.json)은 ctx.work_dir 안에만 둔다.
결과에는 건수·시트 이름·파일 이름만 싣는다 — 번호·학교 이름·예외 메시지는 싣지 않는다.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import time
from pathlib import Path
from typing import Callable, Sequence

import requests
from openpyxl import load_workbook

from compare import (
    SEP,
    build_moa_sheet,
    build_pims_sheet,
    delta_line,
    load_moa,
    load_pims,
    load_sejong,
    pick_latest_dated,
    pick_latest_workbook,
    result_counts,
)
from contract import Context, StepFailure, StepResult
from graph import (
    MOA_DIR,
    PIMS_DIR,
    SEJONG_DIR,
    SMS_ROOT,
    XLSM,
    DriveItem,
    Graph,
    GraphError,
    UploadRejected,
)
from vba import restore_vba
from verify import failed_labels, verify_workbook

STEP = "workbook"
# 앱이 관리하는 시트 — 06·07 을 다시 써도 행 수가 그대로여야 한다
APP_SHEETS = ("_학교", "_서류", "_번호", "_확인")
TARGETS = ("06. Moa 대조", "07. PIMS 대조")

AFTER_RETRIES = 3  # 올린 뒤 행 수가 다르면 다시 보는 횟수
AFTER_WAIT_S = 10  # Graph 통합 문서 읽기가 새 버전을 늦게 보는 것을 기다린다

EXCEL_MAX_S = 600  # Excel 한 번의 상한
EXCEL_MIN_S = 300  # 실행 마감까지 이보다 적게 남으면 Excel 을 띄우지 않는다
EXCEL_RESERVE_S = 120  # Excel 이 끊긴 뒤 정리·보고에 남기는 몫

_SCRIPT = Path(__file__).resolve().parent / "excel_apply.ps1"
_FAILED_LINE = re.compile(r"FAILED at line \d+")

# 결과 counts 키 → 시트 결과 분류
_MOA_KEYS = {"moa_both": "양쪽", "moa_sejong_only": "세종만", "moa_only": "Moa만", "moa_excluded": "대조 제외"}
_PIMS_KEYS = {"pims_both": "양쪽", "pims_sejong_only": "세종만", "pims_only": "PIMS만", "pims_excluded": "대조 제외"}


# ---------------------------------------------------------------- Excel
def _kill_own_excel(pid_file: Path) -> None:
    """excel_apply.ps1 이 적어 둔 PID 하나만 끝낸다 — 사용자가 연 다른 Excel 은 건드리지 않는다."""
    try:
        pid = pid_file.read_text(encoding="ascii").strip()
    except (OSError, ValueError):  # 없음·ASCII 아님(UnicodeDecodeError)
        return
    if pid.isdigit() and int(pid) > 0:
        # PID 가 그 사이 다른 프로그램에 재사용됐어도 Excel 이 아니면 끝내지 않는다
        subprocess.run(["taskkill", "/F", "/PID", pid, "/FI", "IMAGENAME eq EXCEL.EXE"],
                       capture_output=True, check=False)


def excel_timeout(deadline: float | None, now: float) -> int:
    """실행 마감 안에서 Excel 에 줄 시간. 너무 적게 남았으면 띄우지 않고 excel_failed."""
    if deadline is None:
        return EXCEL_MAX_S
    remaining = deadline - now
    if remaining < EXCEL_MIN_S:
        raise StepFailure("excel_failed", "시간 부족")
    return int(min(EXCEL_MAX_S, remaining - EXCEL_RESERVE_S))


def apply_excel(workbook: Path, data: Path, pid_file: Path, timeout_s: int | None = None, *,
                deadline: float | None = None, clock: Callable[[], float] = time.monotonic) -> None:
    """excel_apply.ps1 로 작업 사본에 06·07 을 쓴다. 실패·시간 초과는 excel_failed."""
    if timeout_s is None:
        timeout_s = excel_timeout(deadline, clock())
    pwsh = shutil.which("pwsh")
    if not pwsh:
        raise StepFailure("excel_failed", "pwsh 없음")
    # 지난 실행이 남긴 PID 로 엉뚱한 프로세스를 죽이지 않게 먼저 지운다
    pid_file.unlink(missing_ok=True)
    cmd = [pwsh, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(_SCRIPT),
           "-Workbook", str(workbook), "-Data", str(data), "-PidFile", str(pid_file)]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace",
                           timeout=timeout_s, check=False)
    except subprocess.TimeoutExpired:
        # run() 이 pwsh 는 이미 죽였다. COM 으로 뜬 Excel 은 pwsh 의 자식이 아니라 따로 끝낸다
        _kill_own_excel(pid_file)
        raise StepFailure("excel_failed", f"시간 초과 {timeout_s}초") from None
    if r.returncode != 0:
        # 실패 줄 뒤의 스크립트 원문은 싣지 않는다 — 줄 번호만
        found = _FAILED_LINE.findall(f"{r.stdout or ''}\n{r.stderr or ''}")
        raise StepFailure("excel_failed", found[-1] if found else f"exit {r.returncode}")


# ---------------------------------------------------------------- 내려받기 · 계산
def _graph_failure(e: GraphError) -> StepFailure:
    return StepFailure("source_missing" if e.status == 404 else "unknown", f"GraphError {e.status}")


def _fetch_workbook(graph, work_dir: Path) -> tuple[DriveItem, str, dict[str, int]]:
    """현황 파일 → (항목, 처음 eTag, 앱 시트 행 수). before.xlsm·work.xlsm 을 같은 바이트로 쓴다."""
    wb = pick_latest_workbook(graph.children(SMS_ROOT))
    if wb is None:
        raise StepFailure("source_missing", "현황 파일 없음")
    etag = graph.item(wb.id).etag  # 내려받기보다 먼저
    if not etag:
        raise StepFailure("unknown", "eTag 없음")  # 이대로면 If-Match 없는 덮어쓰기가 된다
    data = graph.download(wb.id)
    (work_dir / "before.xlsm").write_bytes(data)
    (work_dir / "work.xlsm").write_bytes(data)
    app_rows = {s: graph.used_range_rows(wb.id, s) for s in APP_SHEETS}
    return wb, etag, app_rows


def _latest(graph, folder: str, what: str) -> DriveItem:
    it = pick_latest_dated(graph.children(folder))
    if it is None:
        raise StepFailure("source_missing", f"{what} 목록 없음")
    return it


def pick_sources(graph) -> dict[str, DriveItem]:
    """세종·Moa·PIMS 폴더의 그 시점 최신 목록."""
    return {"sejong": _latest(graph, SEJONG_DIR, "세종"),
            "moa": _latest(graph, MOA_DIR, "Moa"),
            "pims": _latest(graph, PIMS_DIR, "PIMS")}


def build_sheet_payloads(graph, sources: dict[str, DriveItem]) -> list[dict]:
    """excel_apply.ps1 에 넘길 시트 목록. 지금은 06·07 둘 — PR-3 이 앱 시트·요약을 같은 목록에 더한다."""
    sej_valid, sej_excl = load_sejong(graph.download(sources["sejong"].id))
    moa, extracted = load_moa(graph.download(sources["moa"].id))
    pims = load_pims(graph.download(sources["pims"].id))
    sejong_label = Path(sources["sejong"].name).stem
    return [build_moa_sheet(moa, sej_valid, sej_excl, sejong_label, extracted),
            build_pims_sheet(pims, sej_valid, sej_excl, sejong_label, Path(sources["pims"].name).stem)]


def read_result_counts(path: Path, sheets: Sequence[dict]) -> dict[str, dict[str, int]]:
    """원본의 기존 06·07 결과 건수(바뀐 점용). 시트가 없으면 빈 dict."""
    wb = load_workbook(path, read_only=True, data_only=True)
    try:
        out: dict[str, dict[str, int]] = {}
        for sd in sheets:
            if sd["sheet"] not in wb.sheetnames:
                out[sd["sheet"]] = {}
                continue
            rows = [r for r in wb[sd["sheet"]].iter_rows(min_row=sd["firstDataRow"], values_only=True)
                    if len(r) > 1]
            out[sd["sheet"]] = result_counts(rows, sd["order"])
        return out
    finally:
        wb.close()


# ---------------------------------------------------------------- 쓰기 · 검사
def _apply_and_verify(work_dir: Path, sheets: list[dict], apply, restore, verify) -> list:
    """작업 사본에 쓰고 매크로를 되돌린 뒤 검사한다. 하나라도 실패면 verify_failed — 올리지 않는다."""
    before, work = work_dir / "before.xlsm", work_dir / "work.xlsm"
    data = work_dir / "data.json"
    data.write_text(json.dumps({"sheets": sheets}, ensure_ascii=False), encoding="utf-8")
    apply(work, data, work_dir / "excel.pid")
    restore(before, work)
    try:
        checks = verify(before, work, sheets)
    except ImportError:
        # '매크로가 바뀌었다' 로 읽히지 않게 따로 적는다
        raise StepFailure("verify_failed", "oletools 없음") from None
    if not checks:
        raise StepFailure("verify_failed", "검사 0건")  # 0/0 을 통과로 읽지 않는다
    failed = failed_labels(checks)
    if failed:
        raise StepFailure("verify_failed", f"{len(failed)}/{len(checks)} 실패: " + SEP.join(failed))
    return checks


# ---------------------------------------------------------------- 올리기 · 올린 뒤 확인
def _upload(graph, item_id: str, data: bytes, etag: str) -> None:
    try:
        if graph.item(item_id).etag != etag:
            raise StepFailure("changed", "올리기 직전 eTag 다름")
        if not etag:
            raise StepFailure("unknown", "eTag 없음")
        try:
            graph.put_if_match(item_id, data, etag, XLSM)
        except (requests.Timeout, requests.ConnectionError) as e:
            # 응답을 못 받았을 뿐 서버는 받았을 수 있다 — '안 올라갔다' 로 읽히지 않게 따로 적는다
            raise StepFailure("upload_unknown", type(e).__name__) from None
    except UploadRejected as e:
        raise StepFailure(e.code) from None
    except GraphError as e:
        raise StepFailure("unknown", f"GraphError {e.status}") from None


def _mismatched(graph, item_id: str, expected: dict[str, int]) -> list[str]:
    bad = []
    for sheet, want in expected.items():
        try:
            got = graph.used_range_rows(item_id, sheet)
        except GraphError:
            got = None
        if got != want:
            bad.append(sheet)
    return bad


def _confirm_after(graph, item_id: str, expected: dict[str, int], sleep: Callable[[float], None]) -> None:
    bad = _mismatched(graph, item_id, expected)
    for _ in range(AFTER_RETRIES):
        if not bad:
            return
        sleep(AFTER_WAIT_S)
        bad = _mismatched(graph, item_id, expected)
    if bad:
        raise StepFailure("after_check", "업로드됨 · 행 수 다름: " + SEP.join(bad))


def _confirm_uploaded(graph, item_id: str, expected: dict[str, int], sleep: Callable[[float], None]) -> None:
    """올린 뒤 확인. 어떤 실패든 '이미 올라갔다' 는 사실을 잃지 않게 after_check 로 끝낸다."""
    try:
        _confirm_after(graph, item_id, expected, sleep)
    except StepFailure:
        raise
    except Exception as e:  # noqa: BLE001 — 올린 뒤라 unknown 으로 두면 '안 올라갔다' 로 읽힌다
        raise StepFailure("after_check", f"업로드됨 · 확인 중 오류 {type(e).__name__}") from None


# ---------------------------------------------------------------- 결과
def _counts(sheets: list[dict], n_checks: int, uploaded: bool) -> dict[str, int]:
    moa, pims = sheets[0]["counts"], sheets[1]["counts"]
    return ({k: moa[v] for k, v in _MOA_KEYS.items()} | {k: pims[v] for k, v in _PIMS_KEYS.items()}
            | {"checks": n_checks, "uploaded": int(uploaded)})


def _changes(sheets: list[dict], prev: dict[str, dict[str, int]]) -> tuple[str, ...]:
    return tuple(delta_line(sd["sheet"], prev.get(sd["sheet"], {}), result_counts(sd["rows"], sd["order"]),
                            sd["order"]) for sd in sheets)


def _etag_tail(graph, item_id: str, etag: str) -> str:
    """시험 실행 끝의 eTag 재확인 — 우리 쪽 읽기(통합 문서 API)가 eTag 를 올리면 실운영은 매번 changed 다."""
    try:
        same = graph.item(item_id).etag == etag
    except GraphError as e:
        raise _graph_failure(e) from None
    return " · eTag 유지" if same else " · eTag 변경됨(업로드였다면 changed)"


def _stale_tail(ctx: Context) -> str:
    tail = ""
    if getattr(ctx.results.get("mail"), "status", None) != "ok":
        tail += " · 새 세종 메일은 확인 못 함"
    for sid, label in (("moa", "Moa"), ("pims", "PIMS")):
        if getattr(ctx.results.get(sid), "status", None) != "ok":
            tail += f" · {label} 는 지난 자료"
    return tail


def run_workbook_step(
    ctx: Context,
    *,
    graph_factory=Graph.from_env,
    apply=None,
    restore=restore_vba,
    verify=verify_workbook,
    sleep: Callable[[float], None] = time.sleep,
) -> StepResult:
    work_dir = ctx.work_dir
    work_dir.mkdir(parents=True, exist_ok=True)
    # 기본은 실행 마감을 Excel 타임아웃에 넘긴다. 부를 때 찾아야 테스트가 apply_excel 을 바꿔 끼울 수 있다
    apply = apply or (lambda wb_path, data, pid: apply_excel(wb_path, data, pid, deadline=ctx.deadline))
    try:
        graph = graph_factory()
        wb, etag, app_rows = _fetch_workbook(graph, work_dir)
        sources = pick_sources(graph)
        sheets = build_sheet_payloads(graph, sources)
    except GraphError as e:
        raise _graph_failure(e) from None
    prev = read_result_counts(work_dir / "before.xlsm", sheets)
    n = len(_apply_and_verify(work_dir, sheets, apply, restore, verify))
    if ctx.dry_run:
        tail = _etag_tail(graph, wb.id, etag)  # PUT 은 안 한다 — eTag 만 다시 본다
        return StepResult(STEP, "ok", f"06·07 갱신 · 검사 {n}/{n} 통과 · 올리지 않음(시험 실행){tail}",
                          counts=_counts(sheets, n, False))

    # 결과는 올리기 전에 만들어 둔다 — 올린 뒤에는 확인 말고 아무것도 실패할 수 없게
    names = f"세종 {sources['sejong'].name} · Moa {sources['moa'].name} · PIMS {sources['pims'].name}"
    done = StepResult(STEP, "ok", f"06·07 갱신 · 검사 {n}/{n} 통과 · 업로드 완료 ({names}){_stale_tail(ctx)}",
                      counts=_counts(sheets, n, True), changes=_changes(sheets, prev))
    expected = {**app_rows, **{sd["sheet"]: sd["firstDataRow"] - 1 + len(sd["rows"]) for sd in sheets}}
    _upload(graph, wb.id, (work_dir / "work.xlsm").read_bytes(), etag)
    _confirm_uploaded(graph, wb.id, expected, sleep)
    return done
