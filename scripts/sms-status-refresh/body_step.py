"""④ 현황 파일 단계의 PR-3b 몫 — 숨김 표 셋(`_학교`·`_서류`·`_번호`)·01~03 보기·`00. 요약`·`_수정` payload.

workbook_step 이 06·07 payload 뒤에 이 목록을 붙여 한 번의 Excel COM 쓰기·한 번의 검사로 보낸다.
순서: 보기 모양(check_targets) → `_수정` 읽기 → (없으면) 기준 판 → 세종 회선 → merge_schools → merge_numbers
→ 보기 payload(새 행 수) → 요약(보기 검색 칸으로 링크) → `_수정` 이어 쓰기.

기준 판(결정 5·Ruling 17) = 지금 고른 현황 파일의 **가장 오래된 버전**. `_수정` 이 없을 때만 받는다.
버전 기록이 하나뿐이면 지금 파일이 곧 기준 판이다. 버전 목록·내려받기가 실패하면 baseline_missing.

통합 문서는 openpyxl 로 **읽기만** 한다. 바뀐 점에는 건수·시트 이름만 싣는다 — 키·학교·번호는 싣지 않는다.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Mapping, Sequence

from openpyxl import load_workbook

from contract import StepFailure
from edits import Ownership, meta_rows
from graph import GraphError
from merge_numbers import merge_numbers
from merge_schools import read_issues, merge_schools
from sejong import group_schools, load_sejong_lines
from sheet_names import SUMMARY_SHEET, VIEW_OF
from sheet_table import check_targets, read_edits
from summary_sheet import base_line, summary_payload
from table_rows import table_payload
from verify_table import LOST, META_HEADER, META_SHEET, Table, read_table
from verify_view import sheet_links
from views import view_payload

SCHOOL, DOCS, NUMBERS = "_학교", "_서류", "_번호"
HIDDEN = (SCHOOL, DOCS, NUMBERS)
KST = timezone(timedelta(hours=9))
_DROPPED = re.compile(r"(\d+)칸$")  # summary_layout.assemble 경고 끝 '값만 씀 N칸'


@dataclass(frozen=True)
class Body:
    sheets: list[dict]  # table×3 · view×3 · summary · meta — excel_apply.ps1·verify 가 받는 payload
    changes: tuple[str, ...]  # 바뀐 점(건수만)
    after_rows: dict[str, int]  # 올린 뒤 숨김 표 사용 범위 행 수
    baseline: Path | None  # verify 에 넘길 기준 판 — `_수정` 이 있으면 None


def kst_today() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d")


# ---------------------------------------------------------------- 기준 판
def fetch_baseline(graph, item_id: str, work_dir: Path, before: Path) -> Path:
    """현황 파일의 가장 오래된 판 → 경로. 판이 하나뿐이면 before 그대로. 못 받으면 baseline_missing."""
    try:
        versions = graph.versions(item_id)
    except GraphError as e:
        raise StepFailure("baseline_missing", f"버전 목록 GraphError {e.status}") from None
    if not versions:
        raise StepFailure("baseline_missing", "버전 기록 없음")
    if len(versions) == 1:
        return before
    # Graph 는 새 판부터 준다 — 시각이 같으면 목록 뒤쪽이 더 오래된 판
    oldest = min(enumerate(versions), key=lambda iv: (iv[1].last_modified, -iv[0]))[1]
    try:
        data = graph.download_version(item_id, oldest.id)
    except GraphError as e:
        raise StepFailure("baseline_missing", f"첫 판 내려받기 GraphError {e.status}") from None
    path = work_dir / "baseline.xlsm"
    path.write_bytes(data)
    return path


def _ownership(old, baseline_fn: Callable[[], Path]) -> tuple[Ownership, Path | None]:
    if old is not None:
        return Ownership.from_meta(old), None
    path = baseline_fn()
    bwb = load_workbook(path)
    missing = [s for s in HIDDEN if s not in bwb.sheetnames]
    if missing:
        raise StepFailure("baseline_missing", f"기준 판에 숨김 표 없음 {len(missing)} — {', '.join(missing)}")
    return Ownership.from_baseline({s: read_table(bwb, s) for s in HIDDEN}), path


# ---------------------------------------------------------------- 결과 줄
def change_lines(tables: Sequence[dict], new_meta: Sequence[Sequence], warnings: Sequence[str]) -> tuple[str, ...]:
    """숨김 표마다 `_번호: 592→599행 · 새 7 · 빠짐 0`, 이번 `못 옮김` 이 있으면 한 줄, 요약 못 건 칸이 있으면 한 줄."""
    out = [f"{p['sheet']}: {p['beforeRows']}→{len(p['rows'])}행 · 새 {len(p['added'])} · 빠짐 {len(p['removed'])}"
           for p in tables]
    lost = sum(1 for r in new_meta if r[0] == LOST)
    if lost:
        out.append(f"옮기지 못한 메모 {lost}건 — _수정 '못 옮김'")
    dropped = sum(int(m.group(1)) for w in warnings if (m := _DROPPED.search(w)))
    if warnings:
        out.append(f"요약 링크 못 건 칸 {dropped}")
    return tuple(out)


def after_rows(tables: Mapping[str, Table], payloads: Sequence[dict]) -> dict[str, int]:
    """올린 뒤 기대 행 = max(머리글 + 새 행 수, U 끝). Graph 사용 범위는 값만 센다(valuesOnly) — 서식만 남은 행은 빠진다."""
    return {p["sheet"]: max(len(p["rows"]) + 1, tables[p["sheet"]].u_last) for p in payloads}


# ---------------------------------------------------------------- 조립
def _merged(t: Table, rows) -> Table:
    return Table(t.header, tuple(map(tuple, rows)), t.u_last)


def _tables(lines, issues, own: Ownership, tables: Mapping[str, Table]):
    """merge_schools → merge_numbers → (table payload 셋, 합친 표, 이번 변경 목록)."""
    sm = merge_schools(tables[SCHOOL], tables[DOCS], group_schools(lines), issues, own)
    merged = {SCHOOL: _merged(tables[SCHOOL], sm.school_rows), DOCS: _merged(tables[DOCS], sm.doc_rows)}
    nm = merge_numbers(tables[NUMBERS], lines, merged[SCHOOL], merged[DOCS], own)
    merged = {**merged, NUMBERS: _merged(tables[NUMBERS], nm.rows)}
    payloads = [table_payload(SCHOOL, tables[SCHOOL], sm.school_rows, sm.added[SCHOOL]),
                table_payload(DOCS, tables[DOCS], sm.doc_rows, sm.added[DOCS]),
                table_payload(NUMBERS, tables[NUMBERS], nm.rows, nm.added, nm.removed)]
    return payloads, merged, (*sm.decisions.changes, *nm.decisions.changes)


def build_body(before: Path, sejong_data: bytes, sejong_name: str, today: str,
               baseline_fn: Callable[[], Path]) -> Body:
    """원본 현황 파일(before) + 세종 리스트 바이트 → PR-3b payload·바뀐 점·기대 행·기준 판."""
    wb = load_workbook(before)
    check_targets(wb)  # 보기 모양이 다르면 기준 판을 받기 전에 멈춘다
    old = read_edits(wb)
    own, baseline = _ownership(old, baseline_fn)
    tables = {s: read_table(wb, s) for s in HIDDEN}
    lines, _warnings = load_sejong_lines(sejong_data)
    issues = read_issues(wb)
    payloads, merged, changes = _tables(lines, issues, own, tables)
    note = base_line(sejong_name, today)  # 01~03 A4 와 00 A5 가 같은 문자열
    views = [view_payload(wb, view, hid, len(merged[hid].rows), note) for view, hid in VIEW_OF.items()]
    search = {p["sheet"]: p["searchCell"] for p in views}
    summary = summary_payload(merged[SCHOOL], merged[DOCS], merged[NUMBERS], issues, search, note,
                              set(sheet_links(wb[SUMMARY_SHEET]).values()))
    rows = meta_rows(old, changes, own, today=today)
    meta = {"kind": "meta", "sheet": META_SHEET, "header": list(META_HEADER), "rows": [list(r) for r in rows]}
    return Body([*payloads, *views, summary, meta],
                change_lines(payloads, rows[len(old or ()):], summary.get("warnings", [])),
                after_rows(tables, payloads), baseline)
