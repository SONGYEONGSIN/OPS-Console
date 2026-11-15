"""행 수식 템플릿 — 지금 행들의 수식에서 '하나의 꼴' 을 추론하고, 새 행·새 끝으로 다시 찍는다.

PR-3b 는 숨김 표의 행 수를 바꾼다. 숨김 P 열(T9·T10)과 보기 시트 행 수식(T11)을 손으로 조립하면
원본과 어긋난 수식이 조용히 들어가므로, 지금 파일에 있는 수식을 템플릿으로 삼는다.

수식 속 정수(셀 참조의 행 번호·숫자 상수)마다 셋 중 하나로 정한다(Ruling 5).
- end   : 시트 접두가 붙은 숨김 시트 범위의 끝 — `_학교!A$2:A$102`·`'_학교'!$P$2:$P$102` 의 102.
          값은 늘 그 표의 마지막 행(`last`)이어야 하고, 렌더할 때 새 `last` 로 바뀐다.
- row   : 행마다 행 번호와의 차가 같다 — `$P9`·`$T2`, P 의 `{i-1}`, SMALL 의 순번 k.
- fixed : 모든 행에서 같다 — 접두 없는 `$U$2:$U$N`(끝이 last 와 같아도), 검색 칸 `$G$6`, MATCH 의 0.
문자열 리터럴(`"…"`) 속 숫자는 건드리지 않는다. 한 행이라도 꼴이 다르면 추론하지 않는다(TemplateMismatch).
행이 둘 미만이면 상수가 fixed 인지 row 인지 가를 수 없어 역시 추론하지 않는다.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Mapping

_SHEET = r"(?:'(?:[^']|'')+'|[^\s'!(),=&:\"+\-*/<>^;{}]+)"
_CELL = r"\$?[A-Z]{1,3}\$?\d+"
_TOKEN = re.compile(
    r'(?P<str>"(?:[^"]|"")*")'
    rf"|(?<![A-Za-z0-9_.$'])(?:(?P<sheet>{_SHEET})!)?(?P<a>{_CELL})(?::(?P<b>{_CELL}))?(?![A-Za-z0-9_(!])"
    r"|(?<![A-Za-z0-9_.$])(?P<num>\d+)(?![A-Za-z0-9_.(])"
)
_ROW = re.compile(r"\d+$")


class TemplateMismatch(ValueError):
    """행 수식이 하나의 템플릿에 안 맞는다 — row 는 처음 어긋난 행(시트 행 번호)."""

    def __init__(self, row: int | None, reason: str):
        super().__init__(f"{row}행: {reason}" if row is not None else reason)
        self.row = row


@dataclass(frozen=True)
class Slot:
    kind: str  # "fixed" | "row" | "end"
    value: int  # fixed = 그 값, row = 행 번호와의 차, end = 0


@dataclass(frozen=True)
class Template:
    parts: tuple[str, ...]  # 정수 자리 사이의 글자 — len(slots) + 1
    slots: tuple[Slot, ...]


def _sheet_name(raw: str | None) -> str | None:
    if raw is None:
        return None
    return raw[1:-1].replace("''", "'") if raw.startswith("'") else raw


def _split(formula, hidden: str) -> tuple[tuple[str, ...], tuple[int, ...], tuple[bool, ...]]:
    """수식 → (정수 자리 사이 글자, 정수들, 그 정수가 숨김 시트 접두 범위의 끝인가)."""
    cuts: list[tuple[int, int, bool]] = []  # (시작, 끝, end 후보)
    for m in _TOKEN.finditer(formula):
        if m["num"] is not None:
            cuts.append((m.start("num"), m.end("num"), False))
        elif m["a"] is not None:
            is_end = m["b"] is not None and _sheet_name(m["sheet"]) == hidden
            for g, end_flag in (("a", False), ("b", is_end)):
                if m[g] is not None:
                    d = _ROW.search(m[g])
                    cuts.append((m.start(g) + d.start(), m.end(g), end_flag))
    parts, values, ends, pos = [], [], [], 0
    for s, e, flag in cuts:
        parts.append(formula[pos:s])
        values.append(int(formula[s:e]))
        ends.append(flag)
        pos = e
    parts.append(formula[pos:])
    return tuple(parts), tuple(values), tuple(ends)


def _slot(pairs: list[tuple[int, int]], is_end: bool, last: int) -> Slot:
    """한 정수 자리의 (행, 값) 목록 → Slot. 어긋나면 처음 어긋난 행으로 TemplateMismatch."""
    if is_end:
        bad = next((r for r, v in pairs if v != last), None)
        if bad is not None:
            raise TemplateMismatch(bad, f"숨김 범위 끝이 {last}행 아님")
        return Slot("end", 0)
    (r0, v0) = pairs[0]
    if all(v == v0 for _r, v in pairs):
        return Slot("fixed", v0)
    if all(v - r == v0 - r0 for r, v in pairs):
        return Slot("row", v0 - r0)
    bad = next((r for r, v in pairs[1:] if v != v0 and v - r != v0 - r0), pairs[1][0])
    raise TemplateMismatch(bad, "숫자가 고정도 행 상대도 아님")


def infer(formulas: Mapping[int, object], *, last: int, hidden: str) -> Template:
    """{시트 행 번호: 수식} → 템플릿. last = 숨김 표의 마지막 행, hidden = 끝이 움직이는 숨김 시트 이름."""
    rows = sorted(formulas)
    if len(rows) < 2:
        raise TemplateMismatch(rows[0] if rows else None, "추론할 행이 둘 미만")
    split = {}
    for r in rows:
        f = formulas[r]
        if not (isinstance(f, str) and f.startswith("=")):
            raise TemplateMismatch(r, "수식 아님")
        split[r] = _split(f, hidden)
    parts, _v, ends = split[rows[0]]
    bad = next((r for r in rows if split[r][0] != parts), None)
    if bad is not None:
        raise TemplateMismatch(bad, "수식 뼈대가 다름")
    slots = tuple(_slot([(r, split[r][1][i]) for r in rows], ends[i], last) for i in range(len(ends)))
    return Template(parts, slots)


def render(t: Template, r: int, last: int) -> str:
    """템플릿을 시트 행 r·숨김 표 마지막 행 last 로 찍는다."""
    def value(s: Slot) -> int:
        return s.value if s.kind == "fixed" else r + s.value if s.kind == "row" else last
    return "".join(p + str(value(s)) for p, s in zip(t.parts, t.slots)) + t.parts[-1]
