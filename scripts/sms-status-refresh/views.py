"""01~03 보기 시트 payload — 숨김 표(`_학교`·`_서류`·`_번호`)의 새 행 수 n 을 보기 시트가 따라가게 한다.

보기 시트는 9행부터 숨김 표를 INDEX 로 본다. 행 수가 바뀌면 행 수식(9~n+8행), 숨김 범위 끝(`숨김!X$2:X$N`),
`/ N건`, 조건부 서식 범위가 함께 움직여야 한다(결정 1). 여기서는 원본 통합 문서를 읽어 COM(T13)이 쓸 값만
만든다 — 쓰기는 하지 않는다. 결과 모양은 fixtures_status.resize_view, 검사는 verify_view.check_view 다.

- 행 수식: sheet_table.view_templates(지금 행들에서 추론한 열별 템플릿)를 formula_template.render 로 찍는다.
  움직이는 끝은 시트 접두가 붙은 숨김 범위뿐이고 `$U$2:$U$N` 같은 고정 범위는 그대로다(Ruling 5).
- 검색 칸: 유효성(DV)이 아니라 숨김 P 열 `MATCH(<보기 칸>, …)` 에서 읽는다(Ruling 7 — 실파일 DV 는 01 하나뿐).
  원본 요약에 그 보기로 가는 링크가 있으면 대상이 이 칸과 같아야 한다.
- 지금 모양이 '옛 행 수' 에 맞지 않으면(`/ N건`·범위 끝·CF 끝) 고칠 기준이 없으므로 view_shape 로 멈춘다.
detail 에는 시트·셀 주소·행 수만 — 셀 값은 싣지 않는다. 통합 문서는 openpyxl 로 읽기만 한다.
"""
from __future__ import annotations

import re

from openpyxl.utils import column_index_from_string, get_column_letter, range_boundaries

from contract import StepFailure
from formula_template import Template, render
from sheet_names import SUMMARY_SHEET, VIEW_OF
from sheet_table import view_templates
from verify_table import COLUMNS, read_table
from verify_view import FIRST, HEAD_LAST, sheet_links

SOURCE_NOTE = "A4"  # 01~03 기준 자료 줄 칸(결정 8) — verify 는 A1~A8 만 면제한다
P_COL = COLUMNS.index("P") + 1

_SHEET = r"(?:'(?P<q>(?:[^']|'')+)'|(?P<u>[^\s'!(),=&:\"+\-*/<>^;{}]+))"
_MATCH = re.compile(rf"MATCH\(\s*{_SHEET}!(?P<cell>\$?[A-Z]{{1,3}}\$?\d+)\s*,")
_RANGE = re.compile(rf"(?P<head>{_SHEET}!\$?[A-Z]{{1,3}}\$?2:\$?[A-Z]{{1,3}}\$?)(?P<end>\d+)")
_COUNT = re.compile(r" / (\d+)건")


def _sheet(m: re.Match) -> str:
    return m["q"].replace("''", "'") if m["q"] is not None else m["u"]


def _fail(view: str, why: str) -> StepFailure:
    return StepFailure("view_shape", f"{view}: {why}")


def _retarget(formula: str, hidden: str, old_end: int, new_end: int) -> tuple[str, list[int]]:
    """숨김 시트 접두 범위 `hidden!X$2:X$N` 의 끝을 new_end 로. 옛 끝이 old_end 가 아닌 것들도 돌려준다
    (그런 범위가 하나도 없으면 [0] — 따라갈 끝이 없다는 것도 실패다)."""
    ends: list[int] = []

    def sub(m: re.Match) -> str:
        if _sheet(m) != hidden:
            return m[0]
        ends.append(int(m["end"]))
        return m["head"] + str(new_end)
    out = _RANGE.sub(sub, formula)
    return out, ([e for e in ends if e != old_end] if ends else [0])


def _count(ws, view: str, hidden: str, old: int, n: int) -> tuple[str, str]:
    """머리(1~8행)의 `/ N건` 수식 하나 → (칸, 새 수식). 표기 숫자와 숨김 범위 끝 두 곳이 바뀐다."""
    spots = [(c.coordinate, c.value) for row in ws.iter_rows(min_row=1, max_row=HEAD_LAST) for c in row
             if isinstance(c.value, str) and c.value.startswith("=") and _COUNT.search(c.value)]
    if len(spots) != 1:
        raise _fail(view, f"'/ N건' 수식 {len(spots)}곳")
    coord, formula = spots[0]
    if [int(x) for x in _COUNT.findall(formula)] != [old]:
        raise _fail(view, f"{coord} '/ N건' 이 옛 행 수 {old} 아님")
    out, bad = _retarget(_COUNT.sub(f" / {n}건", formula), hidden, old + 1, n + 1)
    if bad:
        raise _fail(view, f"{coord} 숨김 범위 끝이 {old + 1}행 아님")
    return coord, out


def _row_formulas(templates: dict[str, Template], n: int) -> list[list[str]]:
    """9~n+8행, A 열부터 템플릿 있는 마지막 열까지. 템플릿 없는 열(데이터와 순번 사이 등)은 ""."""
    by_col = {column_index_from_string(c): t for c, t in templates.items()}
    width = max(by_col)
    return [[render(by_col[j], r, n + 1) if j in by_col else "" for j in range(1, width + 1)]
            for r in range(FIRST, FIRST + n)]


def _cf_moves(ws, view: str, old: int, n: int) -> list[dict[str, str]]:
    """9행에서 시작하는 범위가 든 CF 묶음마다 {range: 지금 sqref, newRange: 끝을 n+8 로}. 끝 ≠ 8+옛 행 수면 실패."""
    out = []
    for cf in ws.conditional_formatting:
        ranges = cf.sqref.sorted()
        bounds = [range_boundaries(str(r)) for r in ranges]
        if not any(b[1] == FIRST for b in bounds):
            continue
        bad = [str(r) for r, b in zip(ranges, bounds) if b[1] == FIRST and b[3] != FIRST + old - 1]
        if bad:
            raise _fail(view, f"조건부 서식 {', '.join(bad)} 끝이 {FIRST + old - 1}행 아님")
        new = [f"{get_column_letter(c0)}{r0}:{get_column_letter(c1)}{FIRST + n - 1}" if r0 == FIRST else str(r)
               for r, (c0, r0, c1, _r1) in zip(ranges, bounds)]
        out.append({"range": " ".join(str(r) for r in ranges), "newRange": " ".join(new)})
    return out


def _search_cell(wb, view: str, hidden: str, old: int) -> str:
    """숨김 P 열 `MATCH(<보기 칸>, …)` 의 칸 — 모든 행에서 같고 시트가 그 보기여야 한다. `$` 없는 주소(`G6`)."""
    found = set()
    for (f,) in wb[hidden].iter_rows(min_row=2, max_row=old + 1, min_col=P_COL, max_col=P_COL, values_only=True):
        m = _MATCH.search(f) if isinstance(f, str) else None
        found.add((_sheet(m), m["cell"].replace("$", "")) if m else None)
    if len(found) != 1 or None in found or next(iter(found))[0] != view:
        raise _fail(view, f"숨김 {hidden} P 열에서 검색 칸을 못 읽음({len(found)}꼴)")
    cell = next(iter(found))[1]
    links = sheet_links(wb[SUMMARY_SHEET]).values() if SUMMARY_SHEET in wb.sheetnames else ()
    linked = {loc.rpartition("!")[2] for loc in links if loc.rpartition("!")[0] == view}
    if linked - {cell}:
        raise _fail(view, f"요약 링크 대상 {'·'.join(sorted(linked))} ≠ 검색 칸 {cell}")
    return cell


def view_payload(wb, view: str, hidden: str, n: int, note_text: str) -> dict:
    """보기 시트 하나를 숨김 표 n 행에 맞출 payload(Ruling 8). view·hidden = sheet_names.VIEW_OF 의 짝.

    note_text 는 T12 `summary_sheet.base_line` 이 조립한 기준 자료 줄 — 받은 그대로 noteText 에 싣는다.
    """
    if VIEW_OF.get(view) != hidden:
        raise _fail(view, "허용 목록 밖")
    if view not in wb.sheetnames or hidden not in wb.sheetnames:
        raise _fail(view, "시트 없음")
    if n < 1:  # 0행 보기를 쓰면 다음 실행이 '행 수식 없음' 으로 그 보기를 영영 못 고친다
        raise _fail(view, f"새 행 수 {n} — 1 이상이어야 함")
    old = len(read_table(wb, hidden).rows)
    templates = view_templates(wb, view, hidden)
    ws = wb[view]
    coord, formula = _count(ws, view, hidden, old, n)
    return {"kind": "view", "sheet": view, "source": hidden, "rows": n, "sourceNote": SOURCE_NOTE,
            "noteText": note_text, "countCell": coord, "countFormula": formula,
            "rowFormulas": _row_formulas(templates, n), "cf": _cf_moves(ws, view, old, n),
            "searchCell": _search_cell(wb, view, hidden, old)}
