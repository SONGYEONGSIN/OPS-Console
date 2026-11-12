"""`00. 요약` 배치 부품 — 출처 `summary.py`·`layout.py` 의 title·section·line·note·link 를 셀 목록으로 옮겼다.

출처는 openpyxl 시트에 바로 쓰고 서식을 입혔다. 여기서는 줄(`Row`) 목록을 만든 뒤 `assemble` 이 1행부터 번호를
매겨 payload 칸(값·링크·툴팁·병합·스타일 키)으로 바꾼다. 서식 적용은 COM(T13 `Write-SummarySheet`)이 한다.

스타일 키 (`STYLE_KEYS`) — 출처 서식 그대로, T13 이 키마다 같은 서식을 입힌다:
- `title`       제목(A1). NanumGothic 14 굵게
- `intro`       ▪ 안내 줄(A2~A5, 기준 자료 줄 포함). 10
- `section`     ■ 섹션 제목. 12 굵게
- `head`        표 머리말. 10 굵게, 가운데·줄바꿈, 아래 검은 가는 선
- `label`       줄 이름(A열). 10, 왼쪽(들여쓰기 1)·줄바꿈, 아래 옅은 선(FFE7E6E6)
- `cell`        값·빈 칸. 10, 가운데·줄바꿈, 아래 옅은 선
- `link`        파란 수. `cell` + 파란(FF0563C1) 밑줄
- `list`        확인 필요 대상 이름(C열, C:I 병합). `cell` 이지만 왼쪽(들여쓰기 1)
- `foot`        ※ 각주. 9, 회색(FF808080)
- `label-total`·`cell-total`·`link-total`  합계 줄. 위 각각 + 굵게, 위 검은 가는 선, 회색 바탕(FFF2F2F2)
행 높이는 그 행 A열 스타일로 정한다(`ROW_HEIGHT`, 없으면 기본). 열 너비 `COL_WIDTHS`(A~I). 눈금선 끔.
"""
from __future__ import annotations

import collections
from dataclasses import dataclass
from typing import Mapping, Sequence

from openpyxl.utils import get_column_letter

WIDTH = 9  # 요약 표 칸 수 (A~I)
STYLE_KEYS = ("title", "intro", "section", "head", "label", "cell", "link", "list", "foot",
              "label-total", "cell-total", "link-total")
ROW_HEIGHT = {"title": 35.1, "intro": 20.1, "section": 24.0, "head": 30.0, "label": 24.0, "label-total": 24.0,
              "foot": 18.0}
COL_WIDTHS = (18,) + (13,) * (WIDTH - 1)
TIP = "누르면 그 장에서 「{key}」{tip}"  # 매크로(StatusPick.ApplyPick)가 낫표 안 값을 검색 칸에 넣는다


@dataclass(frozen=True)
class Cell:
    value: object = ""  # str·int, 빈 칸은 ""
    style: str = "cell"
    sheet: str | None = None  # 파란 수가 갈 보기 시트 — None 이면 값만
    key: str = ""  # 그 장 검색 칸에 넣을 값("" = 전체)
    tip: str = ""  # 툴팁 꼬리(「학교만 보기」 등)


@dataclass(frozen=True)
class Row:
    cells: tuple[Cell, ...] = ()
    merge_tail: bool = False  # C~I 병합(확인 필요 섹션)


GAP = Row()


def title(text: str, notes: Sequence[str], base_text: str) -> list[Row]:
    """1줄 제목, 2줄부터 ▪ 안내 — 기준 자료 줄은 받은 문자열 그대로(이미 ▪ 로 시작한다)."""
    return ([Row((Cell(text, "title"),))] + [Row((Cell(f"▪ {t}", "intro"),)) for t in notes]
            + [Row((Cell(base_text, "intro"),))])


def section(text: str, heads: Sequence[str], merge_tail: bool = False) -> list[Row]:
    head = tuple(Cell(heads[j] if j < len(heads) else "", "head") for j in range(WIDTH))
    return [Row((Cell(text, "section"),)), Row(head, merge_tail)]


def line(label: str, cells: Sequence[tuple], total: bool = False, merge_tail: bool = False,
         list_col: bool = False) -> Row:
    """cells: [(값, 시트, 검색 값, 툴팁 꼬리)] — 시트가 None 이면 링크 없이 값만(출처 summary.line)."""
    sfx = "-total" if total else ""
    out = [Cell(label, "label" + sfx)]
    for v, sheet, key, tip in cells:
        out.append(Cell(v, "cell" + sfx, sheet, key, tip))
    out += [Cell("", "cell" + sfx)] * (WIDTH - len(out))
    if list_col:
        out[2] = Cell(out[2].value, "list")
    return Row(tuple(out), merge_tail)


def note(text: str) -> Row:
    return Row((Cell(text, "foot"),))


def assemble(rows: Sequence[Row], targets: Mapping[str, str | None], tried: Mapping[str, str | None]) -> dict:
    """줄 목록 → {rows, links, merged, tips, styles, warnings}.

    targets = {보기 시트: '시트!셀' 또는 None(링크 안 함)}, tried = 걸려고 했던 대상(경고 문구용).
    링크는 값이 0·빈 칸이 아니고 대상이 있을 때만 — 못 건 파란 수는 값만 쓰고 시트별 칸 수를 warnings 에 적는다.
    """
    out_rows, links, tips, styles, merged = [], {}, {}, {}, []
    dropped: dict[str, int] = collections.Counter()
    for r, row in enumerate(rows, start=1):
        out_rows.append([c.value for c in row.cells])
        if row.merge_tail:
            merged.append(f"C{r}:{get_column_letter(WIDTH)}{r}")
        for j, c in enumerate(row.cells, start=1):
            coord = f"{get_column_letter(j)}{r}"
            target = targets.get(c.sheet) if c.sheet else None
            if c.sheet and c.value and target:
                links[coord], tips[coord] = target, TIP.format(key=c.key, tip=c.tip)
                styles[coord] = c.style.replace("cell", "link")
                continue
            if c.sheet and c.value:
                dropped[c.sheet] += 1
            styles[coord] = c.style
    warnings = [f"{s}: 링크 대상 {tried.get(s) or '(검색 칸 모름)'} 이 원본 요약 링크에 없어 값만 씀 {n}칸"
                for s, n in dropped.items()]
    return {"rows": out_rows, "links": links, "merged": merged, "tips": tips, "styles": styles,
            "warnings": warnings}
