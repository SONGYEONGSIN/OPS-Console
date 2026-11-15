"""`_번호` 보존 갱신 — 세종 순서·No 1..n 으로 다시 쓰되 사람 칸은 같은 키의 원본 값을 둔다(결정 2·3·4).

- 키: `keyed`(= keys.number_keys 를 (원본, 이번 rows) 두 쪽으로)로만 만든다. added·removed·`_수정` 키가 모두
  이 키라서 검사(verify_table·verify_memos)와 계산이 같은 행을 같은 행으로 본다(Ruling 12). 공유 번호(여러 학교가
  같은 번호)는 학교마다 한 행이고 키는 `학교|원문` 이다.
- 세종 열: No·학교명·구분·발신번호·상태·등록일자. 구분은 이어진 `_학교` 행(T9 가 합친 것)을 따르고, 못 찾으면 kind().
- 판정 열(제출 서류·비고): `own.owner(…)` 가 사람이면 원본 그대로(decisions.kept), 기계·새 키면 다시 계산한다.
  제출 서류는 T9 가 합친 `_서류` 행에서, 비고는 덧붙이기만(`번호 없음` 조각만 지운다).
- 사람 칸(나머지 열, 모르는 열 포함): 이어진 키면 원본 값, 새 키면 빈칸(verify `L_NEW`).
- 메모 옮기기: 빠진 키와 새 키를 '정규화 학교명 + 번호 숫자'로 한 번 더 맞춰 본다(하이픈·공백이 달라도 같은 번호).
  짝이 정확히 하나씩이면 원본 비고를 새 행 비고 앞에 두고 덧붙인다(decisions.moved). 둘 이상이면 옮기지 않는다
  (decisions.ambiguous). 옮기는 칸은 비고뿐이다 — 새 키 행의 사람 칸은 빈칸이어야 하고(`L_NEW`), 다른 판정 칸은
  새 키라 `기계` 로 기록되어 다음 실행에 다시 계산된다(비고는 덧붙이기라 남는다).
- 못 옮김(orphans): 빠진 키의 사람 칸 중 값이 있던 칸마다 (키, 열, 원본 값) — `verify_table.removed_memo_cells` 그대로라
  `edits.meta_rows` 가 `_수정` 에 잇는 `못 옮김` 행과 같은 집합·같은 순서다. 비고를 옮긴 짝의 원본 키도 키로는 빠졌으므로
  여기에 든다(verify_memos 는 빠진 키의 메모 칸 전부를 `못 옮김` 으로 요구한다).
- P 는 원본 P 열 템플릿(check_shape)으로 행마다 다시 찍고, T 는 그 행의 최종 값으로 만든다. U 는 안 건드린다.
"""
from __future__ import annotations

import collections
from dataclasses import dataclass
from typing import Mapping, Sequence

from edits import Change, Ownership
from keys import number_digits, school_key, school_keys
from number_rows import number_doc, number_note, number_sejong, number_tags
from sejong import group_schools
from sheet_table import check_shape
from table_rows import (T_INDEX, ambiguous, base_key, blank_row, carry, is_blank, named, replace, tag_cell,
                        with_formulas)
from verify_table import HUMAN, NOTE, SPECS, Table, _col_name, keyed, removed_memo_cells, roles

SHEET = "_번호"
SPEC = SPECS[SHEET]
DOC_COL = "제출 서류"


@dataclass(frozen=True)
class Decisions:
    kept: tuple[tuple[str, str, str], ...]  # 사람 칸이라 원본 값 그대로 둔 판정 칸 (시트, 키, 열)
    changes: tuple[Change, ...]  # edits.meta_rows 입력 — (원본 표, 이번에 쓸 rows)
    moved: tuple[tuple[str, str], ...]  # '학교 + 숫자' 로 비고를 옮긴 (원본 키, 새 키)
    ambiguous: tuple[str, ...]  # 짝이 둘 이상이라 비고를 옮기지 않은 원본 키
    no_doc: tuple[str, ...]  # `_서류` 행을 못 찾아 제출 서류를 계산하지 못한 키(이어진 키는 원본 그대로)


@dataclass(frozen=True)
class NumberMerge:
    rows: list[list]  # `_번호` A~T — table payload rows(칸 값 str·int·수식 문자열, 빈 칸 "")
    added: tuple[str, ...]  # 새 키(이번 rows 순서) — keyed(원본, 이번 rows) 기준
    removed: tuple[str, ...]  # 빠진 키(원본 순서)
    orphans: tuple[tuple[str, str, str], ...]  # 못 옮김 (원본 키, 열, 원본 값) — meta_rows 의 `못 옮김` 과 같다
    decisions: Decisions


def _school_of(t: Table, lines) -> list[dict | None]:
    """회선마다 같은 학교의 표 행({열 이름: 값}) — merge_schools 와 같은 잇기(학교 단위 school_keys, 겹치면 None)."""
    if t.col("학교명") is None or t.col("구분") is None:
        return [None] * len(lines)
    rows = [r for r in t.rows if not all(is_blank(v) for v in r)]
    groups = list(group_schools(lines).items())
    n, k = t.col("학교명"), t.col("구분")
    tk, gk = school_keys([(r[n], r[k]) for r in rows], [(xs[0]["name"], xs[0]["kind"]) for _g, xs in groups])
    amb = ambiguous(tk, gk)
    by_key = {key: named(t, r) for key, r in zip(tk, rows) if base_key(key) not in amb}
    of_group = {g: None if base_key(key) in amb else by_key.get(key) for key, (g, _xs) in zip(gk, groups)}
    return [of_group[(x["univ"], x["name"])] for x in lines]


def _skeleton(t: Table, lines, schools: Table) -> list[list]:
    """세종 순서 행 뼈대 — No 와 세종 열만 채운다(사람 칸·판정 칸은 빈칸)."""
    out = []
    for no, (x, school) in enumerate(zip(lines, _school_of(schools, lines)), start=1):
        kind = school.get("구분") if school and not is_blank(school.get("구분")) else x["kind"]
        values = {"No": no, **number_sejong(x, kind)}
        out.append(blank_row({t.col(name): v for name, v in values.items()}))
    return out


def _aux(t: Table, row) -> tuple[str, str] | None:
    """보조 짝 키 (정규화 학교명, 번호 숫자) — 번호 모양이 아니면 None(옮기지 않는다)."""
    d = number_digits(row[t.col("발신번호")])
    return (school_key(row[t.col("학교명")]), d) if d else None


def _pairs(t: Table, rows, bkeys: Mapping[str, int], akeys: Mapping[str, int]):
    """빠진 키 ↔ 새 키 보조 짝 → ({새 rows 번호: 원본 rows 번호}, 옮김 짝, 모호한 원본 키)."""
    gone = [(k, i, _aux(t, t.rows[i])) for k, i in bkeys.items() if k not in akeys]
    new = [(k, j, _aux(t, rows[j])) for k, j in akeys.items() if k not in bkeys]
    nb = collections.Counter(a for _k, _i, a in gone if a)
    na = collections.Counter(a for _k, _j, a in new if a)
    by_aux = {a: (k, j) for k, j, a in new if a and na[a] == 1}
    src, moved, amb = {}, [], []
    for k, i, a in gone:
        if a is None or not na[a]:
            continue
        if nb[a] == 1 and a in by_aux:
            src[by_aux[a][1]] = i
            moved.append((k, by_aux[a][0]))
        else:
            amb.append(k)
    return src, tuple(moved), tuple(amb)


@dataclass(frozen=True)
class _Ctx:
    t: Table
    own: Ownership  # bind 한 것
    roles: list


def _carried(x: _Ctx, row, i: int, key: str, line, doc) -> tuple[list, list[str], bool]:
    """이어진 키 — 사람 칸은 원본, 판정 칸은 주인에 따라. → (행, 사람이라 둔 열들, 서류 행 없음)."""
    before = x.t.rows[i]
    row = replace(row, {c: carry(before[c]) for c, role in enumerate(x.roles) if role == "person"})
    kept, missing = [], False
    for name in SPEC.judged:
        c = x.t.col(name)
        if x.own.owner(SHEET, key, name, before[c]) == HUMAN:
            kept.append(name)
            row = replace(row, {c: carry(before[c])})
        elif name == NOTE:
            row = replace(row, {c: number_note(before[c], line)})
        else:
            got = number_doc(line, doc)
            missing = got is None
            row = replace(row, {c: carry(before[c]) if got is None else got})
    return row, kept, missing


def _fresh(x: _Ctx, row, src: int | None, line, doc) -> tuple[list, bool]:
    """새 키 — 사람 칸은 빈칸, 판정 칸은 계산. 보조 짝이 있으면 원본 비고를 앞에 둔다."""
    prev = x.t.rows[src][x.t.col(NOTE)] if src is not None else ""
    got = number_doc(line, doc)
    return replace(row, {x.t.col(NOTE): number_note(prev, line), x.t.col(DOC_COL): "" if got is None else got}), \
        got is None


def _fill(x: _Ctx, rows, lines, docs: Table, bkeys, akeys, src) -> tuple[list[list], list, list]:
    inv_a = {j: k for k, j in akeys.items()}
    out, kept, no_doc = [], [], []
    for j, (row, line, doc) in enumerate(zip(rows, lines, _school_of(docs, lines))):
        key = inv_a[j]
        if key in bkeys:
            row, names, missing = _carried(x, row, bkeys[key], key, line, doc)
            kept += [(SHEET, key, n) for n in names]
        else:
            row, missing = _fresh(x, row, src.get(j), line, doc)
        no_doc += [key] if missing else []
        out.append(replace(row, {T_INDEX: tag_cell(number_tags(named(x.t, row)))}))
    return out, kept, no_doc


def _orphans(x: _Ctx, bkeys, akeys) -> tuple[tuple[str, str, str], ...]:
    """빠진 키의 사람 칸 중 값이 있던 칸 — edits.meta_rows `못 옮김` 과 같은 함수·같은 순서."""
    names = [_col_name(x.t.header, i) for i in range(len(x.t.header))]
    cells = removed_memo_cells(x.t.header, x.roles, lambda k, c, v: x.own.owner(SHEET, k, c, v) == HUMAN,
                               x.t.rows, bkeys, akeys)
    return tuple(sorted(cells, key=lambda c: (bkeys[c[0]], names.index(c[1]))))


def merge_numbers(numbers: Table, lines: Sequence[Mapping], schools: Table, docs: Table,
                  own: Ownership) -> NumberMerge:
    """원본 `_번호` 표 + 세종 회선(sejong.load_sejong_lines) + T9 가 합친 `_학교`·`_서류` 표(원본 머리글 +
    merge_schools 의 rows) + 사람 칸 기준(bind 전 Ownership) → 이번에 쓸 A~T rows 와 키 증감·못 옮김·결정.
    모양이 다르면 StepFailure("sheet_shape")."""
    template = check_shape(numbers, SHEET)
    rows = _skeleton(numbers, lines, schools)
    bkeys, akeys = keyed(SPEC, [numbers, Table(numbers.header, tuple(map(tuple, rows)), numbers.u_last)])
    x = _Ctx(numbers, own.bind(SHEET, numbers, bkeys), roles(numbers.header, SPEC))
    src, moved, amb = _pairs(numbers, rows, bkeys, akeys)
    rows, kept, no_doc = _fill(x, rows, lines, docs, bkeys, akeys, src)
    rows = with_formulas(rows, template)
    added = tuple(k for k, _j in sorted(akeys.items(), key=lambda kv: kv[1]) if k not in bkeys)
    removed = tuple(k for k, _i in sorted(bkeys.items(), key=lambda kv: kv[1]) if k not in akeys)
    decisions = Decisions(tuple(kept), (Change(SHEET, numbers, rows, moved),), moved, amb, tuple(no_doc))
    return NumberMerge(rows, added, removed, _orphans(x, bkeys, akeys), decisions)
