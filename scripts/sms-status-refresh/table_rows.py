"""숨김 표 행 조립 공용 — `_학교`·`_서류`(merge_schools) 와 `_번호`(T10 merge_numbers) 가 같이 쓴다.

- rows 는 A~T 스무 칸 리스트이고 칸 값은 str·int·수식 문자열만(빈 칸 "") — COM 이 그대로 운반한다(Ruling 13).
- P 는 원본 P 열에서 추론한 템플릿(`sheet_table.check_shape`)을 행마다 `formula_template.render` 로 찍는다(Ruling 6).
- 키가 겹친 학교(`#2` 가 붙은 키)는 잇지 않는다 — 엉뚱한 줄과 잇는 것보다 손대지 않는 편이 안전하다.
- table payload 는 verify_table.check_table 이 받는 모양 그대로다.
"""
from __future__ import annotations

import collections
import re
from typing import Iterable, Sequence

from formula_template import Template, render
from verify_table import COLUMNS, WIDTH, Table

P_INDEX = COLUMNS.index("P")
T_INDEX = COLUMNS.index("T")
_DUP = re.compile(r"#\d+$")


def carry(v):
    """원본 칸 → rows 칸. 빈 칸은 "" (Excel 은 빈 문자열을 빈 칸으로 쓴다)."""
    return "" if v is None else v


def is_blank(v) -> bool:
    return v is None or v == ""


def text(v) -> str:
    return "" if v is None else str(v)


def carried_rows(table: Table) -> list[list]:
    """원본 행을 그대로 옮긴 rows — 계산은 여기에 새 리스트를 만들어 칸을 바꾼다."""
    return [[carry(v) for v in (list(r) + [None] * WIDTH)[:WIDTH]] for r in table.rows]


def blank_row(values: dict[int, object]) -> list:
    """새 행 뼈대 — 준 칸만 채우고 나머지(사람 칸)는 빈칸."""
    return [values.get(i, "") for i in range(WIDTH)]


def replace(row: Sequence, values: dict[int, object]) -> list:
    return [values.get(i, v) for i, v in enumerate(row)]


def next_no(table: Table, no_col: int | None) -> int:
    """새 행 No 시작값 — 원본 No 중 가장 큰 정수 + 1(정수가 없으면 행 수 + 1)."""
    nos = [r[no_col] for r in table.rows if no_col is not None
           and isinstance(r[no_col], int) and not isinstance(r[no_col], bool)]
    return max(nos, default=len(table.rows)) + 1


def combos(kind, tags: Sequence[str]) -> list[str]:
    """출처 build_xlsx.combos — 태그 + 구분 + `구분 · 태그`."""
    return list(tags) + [kind] + [f"{kind} · {t}" for t in tags]


def tag_cell(tags: Iterable[str]) -> str:
    return "|" + "|".join(tags) + "|"


def with_formulas(rows: Sequence[Sequence], template: Template) -> list[list]:
    """행마다 P 칸을 템플릿으로 다시 찍는다(시트 행 = rows 순서 + 2)."""
    last = len(rows) + 1
    return [replace(r, {P_INDEX: render(template, i, last)}) for i, r in enumerate(rows, start=2)]


def base_key(k: str) -> str:
    """keys._dedupe 가 붙인 `#n` 을 뗀 키."""
    return _DUP.sub("", k)


def ambiguous(*sides: Sequence[str]) -> set[str]:
    """쪽마다 키 목록 → 어느 쪽에서든 두 번 이상 나온 기본 키(`#n` 을 뗀 것)."""
    out: set[str] = set()
    for side in sides:
        counts = collections.Counter(base_key(k) for k in side)
        out |= {k for k, n in counts.items() if n > 1}
    return out


def text_columns(rows: Sequence[Sequence]) -> list[str]:
    """값이 있는 칸이 전부 수식 아닌 문자열인 열(P 제외) — 보낸 문자열이 Excel 에서 숫자·날짜로 바뀌지
    않았는지 검사(L_TEXT)가 본다."""
    out = []
    for i, c in enumerate(COLUMNS):
        vals = [r[i] for r in rows if not is_blank(r[i])]
        if i != P_INDEX and vals and all(isinstance(v, str) and not v.startswith("=") for v in vals):
            out.append(c)
    return out


def table_payload(sheet: str, before: Table, rows: Sequence[Sequence], added: Sequence[str],
                  removed: Sequence[str] = ()) -> dict:
    """숨김 표 payload — {kind: table, sheet, beforeRows, columns, textColumns, rows, added, removed}."""
    return {"kind": "table", "sheet": sheet, "beforeRows": len(before.rows), "columns": list(COLUMNS),
            "textColumns": text_columns(rows), "rows": [list(r) for r in rows],
            "added": list(added), "removed": list(removed)}
