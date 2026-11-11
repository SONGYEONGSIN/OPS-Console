"""PR-3b 쓰기 전 모양 검사 — 숨김 표(`_번호`·`_학교`·`_서류`)·`_수정`·보기 시트(01~03)·`00. 요약`.

계산이 기대는 모양이 아니면 Excel 을 열기 전에 멈춘다(StepFailure). 검사(verify)는 쓴 뒤에 잡지만,
그때는 이미 Excel 작업 시간을 썼고 어디가 틀렸는지 계산 쪽 말로 알려 주지 못한다.
- sheet_shape : 숨김 표 열을 못 찾음, 옮기는 칸(사람 열·기준 판정 열)에 수식·날짜·bool, P 열이 한 꼴이
                아님, `_수정` 머리글이 다름. COM 은 옮기는 칸을 문자열·숫자로만 운반한다(Ruling 13).
- view_shape  : 시트 맵(sheet_names)의 시트가 없음, 보기 행 수식이 하나의 템플릿에 안 맞음.
detail 에는 시트·열 문자·행 번호·건수만 — 셀 값은 싣지 않는다. 통합 문서는 openpyxl 로 읽기만 한다.
"""
from __future__ import annotations

import collections

from openpyxl.utils import column_index_from_string, get_column_letter

from contract import StepFailure
from formula_template import Template, TemplateMismatch, infer
from sheet_names import SUMMARY_SHEET, VIEW_OF
from verify_table import COLUMNS, KEY_NAMES, META_HEADER, META_SHEET, SPECS, Table, edit_rows, read_table, roles
from verify_view import FIRST

P_INDEX = COLUMNS.index("P")
CARRIED = ("person", "judged")  # 다시 계산하지 않고 원본 값을 옮기는 칸
_NO_SHEET = ""  # P 는 표 길이에 매이지 않는다 — 접두 범위가 있어도 끝을 움직이지 않게 없는 시트 이름으로 추론


def _carriable(v) -> bool:
    """COM 이 모양 그대로 옮길 수 있는 값 — 빈 칸·수식 아닌 문자열·숫자. bool 은 int 의 하위형이라 먼저 거른다."""
    if v is None or isinstance(v, bool):
        return v is None
    if isinstance(v, str):
        return not v.startswith("=")
    return isinstance(v, (int, float))


def check_shape(table: Table, sheet: str) -> Template:
    """숨김 표 하나의 모양. 통과하면 P 열 템플릿을 돌려준다 — T9·T10 이 render 로 새 행 P 를 만든다(Ruling 6)."""
    spec = SPECS.get(sheet)
    if spec is None:
        raise StepFailure("sheet_shape", f"{sheet}: 규칙 없음")
    missing = [n for n in dict.fromkeys(spec.sejong + spec.judged + KEY_NAMES[spec.key]) if table.col(n) is None]
    if missing:
        raise StepFailure("sheet_shape", f"{sheet}: 못 찾은 열 {len(missing)} — {', '.join(missing)}")
    carried = [i for i, role in enumerate(roles(table.header, spec)) if role in CARRIED]
    bad = collections.Counter(COLUMNS[i] for row in table.rows for i in carried if not _carriable(row[i]))
    if bad:
        cols = ", ".join(f"{c}열" for c in sorted(bad, key=COLUMNS.index))
        raise StepFailure("sheet_shape", f"{sheet}: 옮길 수 없는 칸(수식·날짜·bool) {sum(bad.values())} — {cols}")
    try:
        return infer({r: row[P_INDEX] for r, row in enumerate(table.rows, start=2)},
                     last=len(table.rows) + 1, hidden=_NO_SHEET)
    except TemplateMismatch as e:
        raise StepFailure("sheet_shape", f"{sheet}: P 열 {e.row}행 꼴이 다름") from None


def read_edits(wb) -> list[tuple[str, ...]] | None:
    """`_수정` 기록 행. 시트가 없으면 None — 그때만 기준 판(SharePoint 첫 판)을 받는다(결정 5).

    반환 모양(T8 `Ownership.from_meta(rows)` 가 받는다): 머리글(1행)은 빼고 2행부터, 끝 빈 행은 뗀다(중간 빈 행은
    남긴다). 행마다 A~G 일곱 칸 = META_HEADER 순서(구분·시트·키·열·값·사유·기록일), 값은 전부 str(빈 칸 "").
    1행이 META_HEADER 와 다르면 sheet_shape — 다른 열 순서 위에 이어 쓰면 기록이 섞인다.
    """
    if META_SHEET not in wb.sheetnames:
        return None
    ws = wb[META_SHEET]
    head = next(ws.iter_rows(min_row=1, max_row=1, max_col=len(META_HEADER), values_only=True), ())
    if tuple("" if h is None else str(h).strip() for h in head) != META_HEADER:
        raise StepFailure("sheet_shape", f"{META_SHEET}: 머리글이 다름")
    rows = [tuple("" if v is None else str(v) for v in r) for r in edit_rows(ws) or []]
    while rows and not any(rows[-1]):
        rows.pop()
    return rows


def view_templates(wb, view: str, hidden: str) -> dict[str, Template]:
    n = len(read_table(wb, hidden).rows)
    cells = {r: {get_column_letter(c): v for c, v in enumerate(vals, start=1) if v not in (None, "")}
             for r, vals in enumerate(wb[view].iter_rows(min_row=FIRST, max_row=FIRST + n - 1, values_only=True),
                                      start=FIRST)} if n else {}
    cols = sorted({c for row in cells.values() for c in row}, key=column_index_from_string)
    if not cols:
        raise StepFailure("view_shape", f"{view}: 행 수식 없음(숨김 표 {n}행)")
    out = {}
    for col in cols:
        try:
            out[col] = infer({r: row.get(col) for r, row in cells.items()}, last=n + 1, hidden=hidden)
        except TemplateMismatch as e:
            raise StepFailure("view_shape", f"{view}: {col}열 {e.row}행 꼴이 다름") from None
    return out


def check_targets(wb) -> dict[str, dict[str, Template]]:
    """시트 맵의 시트가 모두 있고, 보기 시트마다 9행부터 숨김 표 행 수만큼의 행 수식이 열마다 한 템플릿인가.

    통과하면 {보기 시트: {열 문자: 템플릿}} — T11 이 새 행 수식을 render 로 찍는다.
    끝(`숨김시트!X$2:X$N`)이 숨김 표 마지막 행과 다르면(보기가 옛 범위를 본다) 이것도 view_shape.
    """
    need = (SUMMARY_SHEET, *VIEW_OF, *VIEW_OF.values())
    missing = [s for s in need if s not in wb.sheetnames]
    if missing:
        raise StepFailure("view_shape", f"시트 없음 {len(missing)} — {', '.join(missing)}")
    return {view: view_templates(wb, view, hidden) for view, hidden in VIEW_OF.items()}
