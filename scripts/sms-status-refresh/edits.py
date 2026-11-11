"""사람 칸 기준 — 숨김 표 기준 판정 열 칸의 주인(기계/사람), `_수정` 에 이을 기록 행, 비고 덧붙이기.

판정은 검사(verify_table.Owners)와 **한 벌**이다. 분류는 `verify_table.edits_index`, 판정은
`verify_table.Owners.human_fn` 을 그대로 쓴다 — 다시 짜면 한쪽만 고쳐지는 날 검사는 '사람', 계산은 '기계' 로
갈려 매 실행 verify_failed 가 난다. import 방향: edits → verify_table(verify_table 은 edits 를 모른다).

규칙(결정 5, verify 와 같다):
- `_수정` 이 있으면 그 기록만 본다 — (시트, 키, 열)에 `사람` 행이 있으면 사람, 아니면 마지막 `기계` 행 값과
  원본 값을 str 로 비교(None → "")해 같을 때만 기계. 기계 행이 없으면 사람. `못 옮김` 은 판정에 안 쓴다.
- 없으면 기준 판(SharePoint 첫 판) — (원본, 기준 판)으로 따로 키를 이어 같은 키·같은 열 값이 타입까지 같으면 기계,
  행·열·시트가 없으면 사람.
- 키 = keys.school_keys/number_keys 를 (원본, 이번에 쓸 표)로 돌린 키, 열 = 괄호 꼬리를 뗀 머리글(없으면 `I열`).
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable, Mapping, Sequence

from verify_table import (HUMAN, LOST, MACHINE, META_HEADER, SPECS, Owners, Table, _col_name, _text, edits_index,
                          keyed, removed_memo_cells, roles)

REASON = {MACHINE: "다시 계산", HUMAN: "사람이 고친 칸", LOST: "키가 빠져 옮기지 못함"}
_DAY = re.compile(r"\d{4}-\d{2}-\d{2}")
Judge = Callable[[str, str, object], bool]  # (원본 키, 열 이름, 원본 값) → 사람 칸인가


class Ownership:
    """기준 판정 열 칸의 주인. 시트마다 `bind` 로 원본 표·키를 묶은 뒤 `owner` 로 묻는다(불변 — bind 는 새 객체)."""

    def __init__(self, owners: Owners | None = None, edits: tuple[dict, set, int] | None = None,
                 judges: Mapping[str, Judge] | None = None):
        self._owners = owners or Owners()  # 아무 기준도 없으면 전부 사람
        self._machine, self._people = (dict(edits[0]), frozenset(edits[1])) if edits else ({}, frozenset())
        self._edits = edits
        self._judges = dict(judges or {})

    @classmethod
    def from_meta(cls, rows: Sequence[Sequence]) -> "Ownership":
        """`_수정` 기록 행(`sheet_table.read_edits` — 머리글 뺀 A~G str)."""
        index = edits_index(rows)
        return cls(Owners(edits=index), index)

    @classmethod
    def from_baseline(cls, tables: Mapping[str, Table]) -> "Ownership":
        """기준 판의 숨김 표 {시트: verify_table.read_table 결과}. `_수정` 이 없는 첫 실행에만."""
        return cls(Owners(baseline=dict(tables)))

    def bind(self, sheet: str, before: Table, keys: Mapping[str, int]) -> "Ownership":
        """원본 표와 그 키 {원본 키: before.rows 번호}(`keyed(spec, [원본, 이번 표])[0]`)를 묶는다."""
        judge = self._owners.human_fn(sheet, SPECS[sheet], before, dict(keys))
        return Ownership(self._owners, self._edits, {**self._judges, sheet: judge})

    def owner(self, sheet: str, key: str, col: str, value) -> str:
        """원본 칸 값으로 판정해 HUMAN | MACHINE. bind 하지 않은 시트는 ValueError."""
        if sheet not in self._judges:
            raise ValueError(f"{sheet}: bind 하지 않은 시트")
        return HUMAN if self._judges[sheet](key, col, value) else MACHINE

    def record(self, sheet: str, key: str, col: str, kind: str, value) -> bool:
        """이번에 `_수정` 에 (kind, 값) 행을 이어야 하는가 — 이미 같은 기록이면 안 잇는다.

        사람: 이미 `사람` 으로 굳었으면 안 잇는다. 기계: 마지막 기계 값이 같으면 안 잇는다
        (첫 실행엔 기계 기록이 없으니 빈 값까지 전부 잇는다 — 안 그러면 다음 실행에 전부 사람 칸이 된다).
        """
        where = (sheet, key, col)
        if kind == HUMAN:
            return where not in self._people
        return self._machine.get(where) != _text(value)


@dataclass(frozen=True)
class Change:
    sheet: str  # 숨김 표 — SPECS 에 있는 것
    before: Table  # 원본 표(verify_table.read_table)
    rows: Sequence[Sequence]  # 이번에 쓸 A~T 행 = table payload rows(원본 머리글 순서)


def _row(kind: str, sheet: str, key: str, col: str, value, today: str) -> tuple[str, ...]:
    return (kind, sheet, key, col, _text(value), REASON[kind], today)


def _judged_rows(ch: Change, own: Ownership, bkeys: dict, after: Table, today: str) -> list[tuple[str, ...]]:
    header, spec = ch.before.header, SPECS[ch.sheet]
    judged = [(i, _col_name(header, i)) for i, role in enumerate(roles(header, spec)) if role == "judged"]
    out = []
    for k, j in sorted(keyed(spec, [ch.before, after])[1].items(), key=lambda kv: kv[1]):
        for i, col in judged:
            new = after.rows[j][i]
            kind = own.owner(ch.sheet, k, col, ch.before.rows[bkeys[k]][i]) if k in bkeys else MACHINE
            if own.record(ch.sheet, k, col, kind, new):
                out.append(_row(kind, ch.sheet, k, col, new, today))
    return out


def _lost_rows(ch: Change, own: Ownership, bkeys: dict, akeys: dict, today: str) -> list[tuple[str, ...]]:
    """빠진 키의 사람 칸 중 값이 있던 칸마다 1행 — verify_memos 가 대조하는 집합과 같은 함수(removed_memo_cells)."""
    header, spec = ch.before.header, SPECS[ch.sheet]
    names = [_col_name(header, i) for i in range(len(header))]
    cells = removed_memo_cells(header, roles(header, spec), lambda k, c, v: own.owner(ch.sheet, k, c, v) == HUMAN,
                               ch.before.rows, bkeys, akeys)
    return [_row(LOST, ch.sheet, k, col, v, today)
            for k, col, v in sorted(cells, key=lambda c: (bkeys[c[0]], names.index(c[1])))]


def _sheet_rows(ch: Change, ownership: Ownership, today: str) -> list[tuple[str, ...]]:
    after = Table(ch.before.header, tuple(tuple(r) for r in ch.rows), ch.before.u_last)
    bkeys, akeys = keyed(SPECS[ch.sheet], [ch.before, after])
    own = ownership.bind(ch.sheet, ch.before, bkeys)
    return _judged_rows(ch, own, bkeys, after, today) + _lost_rows(ch, own, bkeys, akeys, today)


def meta_rows(old: Sequence[Sequence] | None, changes: Sequence[Change], ownership: Ownership, *,
              today: str) -> list[tuple[str, ...]]:
    """`_수정` 데이터 행(머리글 제외) 전체 = 원본 행 그대로 + 이번 실행 행 — meta payload rows.

    - old: 원본 `_수정` 행(`sheet_table.read_edits`, 첫 실행이면 None). 앞에 그대로 둔다(이어 쓰기, `못 옮김` 도).
    - changes: 숨김 표마다 원본 표와 이번에 쓸 행. ownership: `from_meta(old)` 또는 첫 실행 `from_baseline(…)`.
    - today: 기록일 `"YYYY-MM-DD"`(KST, 시계 주입 — 부르는 쪽이 정한다). 형식이 다르면 ValueError.
    이번 행(표 순서 → 이번 표 행 순서 → 열 순서, 그 뒤 빠진 키 `못 옮김`):
    - 판정 칸마다: 사람이면 `사람`(이미 굳었으면 생략), 기계·새 키면 `기계`(마지막 기계 값과 같으면 생략). 값 = 이번에 쓴 값.
    - 빠진 키의 사람 칸 중 값이 있던 칸마다 `못 옮김`(키 = 원본 쪽 키, 값 = 원본 값).
    반환 행은 A~G 일곱 칸(META_HEADER 순서), **전부 str** — Excel '@' 서식 계약(쓰기는 T13 COM).
    """
    if not isinstance(today, str) or not _DAY.fullmatch(today):
        raise ValueError("today 는 YYYY-MM-DD 문자열")
    width = len(META_HEADER)
    out = [tuple(_text(v) for v in (list(r) + [""] * width)[:width]) for r in old or ()]
    for ch in changes:
        out += _sheet_rows(ch, ownership, today)
    return out


def append_only(cur, new, sep: str) -> str:
    """cur 에 new 의 조각 중 cur 에 없는 것만 sep 로 덧붙인다(결정 6·Ruling 19) — cur 는 한 글자도 안 바꾼다.

    조각은 sep 로만 나눈다 — 출처의 `"; "` 결합은 한 조각이다. 비교는 앞뒤 공백을 뗀 조각끼리.
    """
    def parts(v) -> list[str]:
        return [p.strip() for p in _text(v).split(sep) if p.strip()]
    have = parts(cur)
    extra = [p for p in dict.fromkeys(parts(new)) if p not in have]
    head = _text(cur)
    return sep.join(([head] if have else []) + extra)
