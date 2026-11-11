"""`_학교`·`_서류` 보존 갱신 — 원본 행은 제자리에 두고 세종 열·기준 판정 열만 다시 계산한다(결정 2·4).

- 행 잇기: 정규화 학교명(겹치면 `+구분`, keys.school_keys)으로 원본 행과 세종 그룹(group_schools)을 잇는다.
  기본 키(`#n` 을 뗀 키)가 어느 쪽에서든 두 번 이상이면(이름·구분이 같은 학교가 둘) 그 학교는 **잇지 않는다** —
  원본 행은 손대지 않고(P 만 다시 찍는다) 새 행도 만들지 않으며 decisions.ambiguous 에 남긴다.
- 새 학교: 끝에 붙이고 No 는 원본 최대 No 다음부터. 사람 칸은 빈칸 — 단 `_서류` 제출 상태는 `서류 확인 안 됨`
  (verify_table `_check_new` 계약). 신청서·위임장 등 서류 표시와 미제출 서류도 빈칸이다.
- 세종에서 빠진 학교: 행을 남기고 세종 열만 0·`-`·`번호 없음`(사용자 결정). 판정 열(제출 서류·확인·비고)과
  사람 칸은 원본 그대로, T 만 그 행의 최종 값으로 다시 만든다. `_서류` 도 세종 열과 T 만 바뀐다.
- 판정 열(`_학교` 제출 서류·확인·비고): `own.owner(…)` 가 사람이면 원본 값 그대로(decisions.kept), 기계면 다시 계산.
  `_서류` 는 판정 열이 없다(verify_table.SPECS).
- P 는 원본 P 열 템플릿(check_shape)으로 행마다 다시 찍고, T 는 그 행의 최종 값으로 만든다. U 는 안 건드린다.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, Sequence

from contract import StepFailure
from edits import Change, Ownership
from keys import school_keys
from school_rows import (NO_DOC_CHECK, doc_brief, doc_sejong, doc_tags, issue_names, school_check, school_note,
                         school_sejong, school_tags)
from sheet_table import check_shape
from table_rows import (T_INDEX, ambiguous, base_key, blank_row, carried_rows, is_blank, named, next_no, replace,
                        tag_cell, with_formulas)
from verify_table import HUMAN, SPECS, WIDTH, Table, base_name, keyed

SCHOOL, DOCS = "_학교", "_서류"
ISSUE_SHEET, ISSUE_TARGET = "_확인", "대상"
STATUS = "제출 상태"


@dataclass(frozen=True)
class Decisions:
    kept: tuple[tuple[str, str, str], ...]  # 사람 칸이라 원본 값 그대로 둔 판정 칸 (시트, 키, 열)
    changes: tuple[Change, ...]  # edits.meta_rows 입력 — 숨김 표마다 (원본 표, 이번에 쓸 rows)
    ambiguous: tuple[tuple[str, str], ...]  # 이름·구분이 겹쳐 세종과 잇지 않은 (시트, 기본 키)
    no_doc: tuple[str, ...]  # `_서류` 행을 못 찾아 제출 서류를 그대로 둔 `_학교` 키


@dataclass(frozen=True)
class SchoolMerge:
    school_rows: list[list]  # `_학교` A~T — table payload rows
    doc_rows: list[list]  # `_서류` A~T
    added: dict[str, tuple[str, ...]]  # {시트: 새 키} — keys.school_keys(원본, 이번 rows) 와 같다
    vanished: dict[str, tuple[str, ...]]  # {시트: 세종에서 빠진 원본 키} — 행은 남아 있다
    decisions: Decisions


def read_issues(wb) -> tuple[dict[str, object], ...]:
    """`_확인` 데이터 행 → {머리글 이름: 값}(A~T 중 머리글 있는 열, 빈 행 제외). 없으면 sheet_shape."""
    if ISSUE_SHEET not in wb.sheetnames:
        raise StepFailure("sheet_shape", f"{ISSUE_SHEET}: 시트 없음")
    rows = list(wb[ISSUE_SHEET].iter_rows(max_col=WIDTH, values_only=True))
    names = [base_name(h) for h in (rows[0] if rows else ())]
    if ISSUE_TARGET not in names:
        raise StepFailure("sheet_shape", f"{ISSUE_SHEET}: {ISSUE_TARGET} 열 없음")
    out = []
    for r in rows[1:]:
        rec = {n: v for n, v in zip(names, r) if n}
        if any(not is_blank(v) for v in rec.values()):
            out.append(rec)
    return tuple(out)


@dataclass(frozen=True)
class _Plan:
    rows: list[list]  # 원본 행(빈 칸 "") + 끝에 새 행 뼈대 — 계산 전
    lines: list  # 행마다 세종 회선 목록. 빠진 학교 (), 손대지 않을 행 None
    vanished: tuple[int, ...]  # 세종과 잇지 못한 원본 행 번호
    held: tuple[str, ...]  # 잇지 않은 기본 키


def _pairs(t: Table, rows) -> list[tuple]:
    n, k = t.col("학교명"), t.col("구분")
    return [(r[n], r[k]) for r in rows]


def _plan(t: Table, groups: Mapping, new_values: dict[int, object]) -> _Plan:
    rows, gl = carried_rows(t), list(groups.values())
    sk, gk = school_keys(_pairs(t, rows), [(xs[0]["name"], xs[0]["kind"]) for xs in gl])
    amb = ambiguous(sk, gk) | {base_key(k) for k, r in zip(sk, rows) if all(is_blank(v) for v in r)}
    by_key = {k: xs for k, xs in zip(gk, gl) if base_key(k) not in amb}
    lines = [None if base_key(k) in amb else by_key.get(k, ()) for k in sk]
    vanished = tuple(i for i, k in enumerate(sk) if base_key(k) not in amb and k not in by_key)
    new = [xs for k, xs in zip(gk, gl) if base_key(k) not in amb and k not in set(sk)]
    no, cols = next_no(t, t.col("No")), (t.col("No"), t.col("학교명"), t.col("구분"))
    for j, xs in enumerate(new):
        rows.append(blank_row({**dict(zip(cols, (no + j, xs[0]["name"], xs[0]["kind"]))), **new_values}))
        lines.append(xs)
    held = tuple(sorted({base_key(k) for k in sk + gk if base_key(k) in amb}))
    return _Plan(rows, lines, vanished, held)


def _set(t: Table, row, values: Mapping[str, object]) -> list:
    return replace(row, {t.col(n): v for n, v in values.items()})


def _keys(sheet: str, t: Table, rows) -> tuple[dict[str, int], dict[str, int]]:
    return tuple(keyed(SPECS[sheet], [t, Table(t.header, tuple(map(tuple, rows)), t.u_last)]))


def _summary(sheet: str, t: Table, plan: _Plan, rows) -> tuple[dict[int, str], tuple[str, ...], tuple[str, ...]]:
    """({원본 행: 원본 키}, 새 키, 빠진 키)."""
    bkeys, akeys = _keys(sheet, t, rows)
    inv = {i: k for k, i in bkeys.items()}
    added = tuple(k for k, _i in sorted(akeys.items(), key=lambda kv: kv[1]) if k not in bkeys)
    return inv, added, tuple(inv[i] for i in plan.vanished if i in inv)


def _merge_docs(docs: Table, groups: Mapping) -> tuple[_Plan, list[list]]:
    status = docs.col(STATUS)
    plan = _plan(docs, groups, {} if status is None else {status: NO_DOC_CHECK})
    rows = []
    for row, xs in zip(plan.rows, plan.lines):
        if xs is not None:
            row = _set(docs, row, doc_sejong(xs))
            row = replace(row, {T_INDEX: tag_cell(doc_tags(named(docs, row)))})
        rows.append(row)
    return plan, rows


def _doc_of(school: Table, srows, docs: Table, drows) -> list[dict | None]:
    """`_학교` 행마다 같은 학교의 `_서류` 행({열 이름: 값}) — 이름이 겹치거나 제출 상태 열이 없으면 None."""
    if docs.col(STATUS) is None:
        return [None] * len(srows)
    sk, dk = school_keys(_pairs(school, srows), _pairs(docs, drows))
    amb = ambiguous(sk, dk)
    by = {k: named(docs, r) for k, r in zip(dk, drows) if base_key(k) not in amb}
    return [None if base_key(k) in amb else by.get(k) for k in sk]


def _judged(school: Table, row, xs, doc, issues: set[str]) -> dict[str, object]:
    """판정 열 다시 계산 값. 제출 서류는 `_서류` 행이 없으면 뺀다(그대로 둔다)."""
    v = named(school, row)
    out = {"확인": school_check(v.get("학교명"), xs, issues), "비고": school_note(v.get("비고"), xs)}
    return out if doc is None else {"제출 서류": doc_brief(doc.get(STATUS), doc), **out}


def _school_row(school: Table, own: Ownership, i: int, row, xs, doc, issues, key):
    """한 행 → (새 행, 사람이라 둔 열 이름들, 서류 행 없음 여부)."""
    row = _set(school, row, school_sejong(xs))
    computed, kept = _judged(school, row, xs, doc, issues), []
    for name in SPECS[SCHOOL].judged:
        c = school.col(name)
        if key is not None and own.owner(SCHOOL, key, name, school.rows[i][c]) == HUMAN:
            kept.append(name)
        elif name in computed:
            row = replace(row, {c: computed[name]})
    row = replace(row, {T_INDEX: tag_cell(school_tags(named(school, row)))})
    return row, kept, doc is None


def _merge_school(school: Table, groups, docs: Table, drows, issues, own: Ownership):
    plan = _plan(school, groups, {})
    inv, added, vanished = _summary(SCHOOL, school, plan, plan.rows)
    bound = own.bind(SCHOOL, school, {k: i for i, k in inv.items()})
    rows, kept, no_doc = [], [], []
    gone = set(plan.vanished)
    for i, (row, xs, doc) in enumerate(zip(plan.rows, plan.lines, _doc_of(school, plan.rows, docs, drows))):
        if xs is None:
            rows.append(row)
            continue
        if i in gone:  # 세종에서 빠진 학교 — 세종 열만 0·`-`, 판정 열은 원본 그대로(결정 2)
            row = _set(school, row, school_sejong(xs))
            rows.append(replace(row, {T_INDEX: tag_cell(school_tags(named(school, row)))}))
            continue
        row, names, missing = _school_row(school, bound, i, row, xs, doc, issues, inv.get(i))
        rows.append(row)
        kept += [(SCHOOL, inv[i], n) for n in names]
        no_doc += [inv.get(i, row[school.col("학교명")])] if missing else []
    return plan, rows, added, vanished, tuple(kept), tuple(no_doc)


def merge_schools(school: Table, docs: Table, groups: Mapping, issues: Sequence[Mapping],
                  own: Ownership) -> SchoolMerge:
    """원본 `_학교`·`_서류` 표 + 세종 그룹(sejong.group_schools) + `_확인` 행(read_issues) + 사람 칸 기준
    (bind 전 Ownership) → 이번에 쓸 A~T rows 와 키 증감·결정. 모양이 다르면 StepFailure("sheet_shape")."""
    templates = check_shape(school, SCHOOL), check_shape(docs, DOCS)
    dplan, drows = _merge_docs(docs, groups)
    targets = issue_names(r.get(ISSUE_TARGET) for r in issues)
    splan, srows, s_added, s_vanished, kept, no_doc = _merge_school(school, groups, docs, drows, targets, own)
    _dinv, d_added, d_vanished = _summary(DOCS, docs, dplan, drows)
    srows, drows = with_formulas(srows, templates[0]), with_formulas(drows, templates[1])
    held = tuple((SCHOOL, k) for k in splan.held) + tuple((DOCS, k) for k in dplan.held)
    decisions = Decisions(kept, (Change(SCHOOL, school, srows), Change(DOCS, docs, drows)), held, no_doc)
    return SchoolMerge(srows, drows, {SCHOOL: s_added, DOCS: d_added}, {SCHOOL: s_vanished, DOCS: d_vanished},
                       decisions)
