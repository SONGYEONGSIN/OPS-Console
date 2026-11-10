"""업로드 전 검사 ① — 숨김 시트(`_번호`·`_학교`·`_서류`)를 다시 쓴 작업 사본에서 **사람 칸이 지켜졌는가.**

PR-3b 는 이 세 장의 2행부터 A~T 를 통째로 다시 쓴다(계획서 결정 1). 행이 늘고 줄고 `_번호` 는 순서까지
바뀌므로 06·07 처럼 '대상 외 셀 그대로' 로는 못 본다 — 행을 **키**(keys.py, 결정 3)로 이어 칸마다 본다.

열은 1행 머리글 이름으로 가른다(괄호 꼬리 `(10/15 기준)` 는 뗀다, 결정 4).
- 세종 열: 다시 계산한다. 여기선 안 본다 — 값은 '데이터 = 생성 데이터' 가 payload 와 대조한다.
- 기준 판정 열: 주인(Owners, 결정 5)이 사람이면 사람 칸, 기계면 다시 계산해도 된다.
  비고는 주인과 무관하게 **덧붙이기만** — 지울 수 있는 건 `번호 없음` 뿐(결정 6).
- 나머지(모르는 열 포함, P·T 제외): 사람 칸 — 같은 키의 값이 그대로여야 한다.
- P·T 는 다시 쓰는 계산 열, U(고를 값)부터 오른쪽은 아무도 안 쓴다 — 칸 단위로 그대로여야 한다.

통합 문서는 openpyxl 로 읽기만 한다. detail 에는 건수·시트·열 이름만 — 셀 값·키는 싣지 않는다.
"""
from __future__ import annotations

import collections
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

from keys import number_keys, school_keys
from verify import Check, cell_repr, sheet_cells, sheet_meta

COLUMNS = tuple(get_column_letter(i) for i in range(1, 21))  # A~T — 다시 쓰는 범위
WIDTH = len(COLUMNS)
U_COL = 21  # 고를 값 — 이름 정의 `고를값_*` 와 P 의 MATCH 가 마지막 행을 박아 둔다
REWRITTEN = ("P", "T")
NOTE, NOTE_SEP, REMOVABLE_NOTE = "비고", " / ", "번호 없음"
META_SHEET = "_수정"
META_HEADER = ("구분", "시트", "키", "열", "값", "사유", "기록일")
HUMAN, MACHINE = "사람", "기계"
_SHOWN = 5  # detail 에 적는 열 이름 수 상한


@dataclass(frozen=True)
class Spec:
    key: str  # "number" | "school"
    sejong: tuple[str, ...]
    judged: tuple[str, ...]
    rows_stay: bool  # 결정 2 — 세종에서 빠진 학교도 행을 남긴다


SPECS = {
    "_번호": Spec("number", ("No", "학교명", "구분", "발신번호", "상태", "등록일자"), ("제출 서류", NOTE), False),
    "_학교": Spec("school", ("등록 회선", "일괄 등록", "추가 등록", "서류 미비", "최근 등록일"),
                ("제출 서류", "확인", NOTE), True),
    "_서류": Spec("school", ("등록 회선", "세종 등록 상태"), (), True),
}
KEY_NAMES = {"number": ("학교명", "발신번호"), "school": ("학교명", "구분")}

L_KNOWN = "숨김 시트 규칙 있음"
L_HEADER = "머리글(1행) 그대로·열 이름 알려짐"
L_DATA = "데이터 = 생성 데이터(A~T, 2행~)"
L_TEXT = "텍스트 열 전부 텍스트"
L_U = "U(고를 값)부터 오른쪽 그대로"
L_META = "틀 고정·병합·조건부 서식·유효성 그대로"
L_PERSON = "사람 칸 = 같은 키의 원본"
L_NOTE = "비고는 덧붙이기만"
L_LOST = "빠진 행의 메모 = removed"
L_KEYS = "새·빠진 키 = 생성 데이터"
CHECKS_PER_TABLE = 9


def label(sheet: str, name: str) -> str:
    return f"{sheet}: {name}"


def _blank(v) -> bool:
    return v is None or v == ""


def _same(a, b) -> bool:
    """타입까지 본다(번호 문자열 ↔ 숫자는 다르다). 빈 문자열 = 빈 칸."""
    return cell_repr(None if a == "" else a) == cell_repr(None if b == "" else b)


def _text(v) -> str:
    return "" if v is None else str(v)


def base_name(header) -> str:
    """머리글에서 괄호 꼬리를 뗀 이름 — `제출 서류 (10/15 기준)` → `제출 서류`."""
    return re.sub(r"\s*\([^)]*\)\s*$", "", _text(header)).strip()


def _names(names) -> str:
    shown = ", ".join(names[:_SHOWN])
    return shown + (f" 외 {len(names) - _SHOWN}" if len(names) > _SHOWN else "")


# ---------------------------------------------------------------- 읽기
@dataclass(frozen=True)
class Table:
    header: tuple  # 1행 A~T
    rows: tuple  # 2행부터 A~T — 끝 빈 행만 떼고 중간 빈 행은 남긴다
    u_last: int  # U 마지막 값 행(없으면 1)

    def col(self, name: str) -> int | None:
        """머리글 이름 → 칸 번호(0부터). 없거나 둘 이상이면 None."""
        found = [i for i, h in enumerate(self.header) if base_name(h) == name]
        return found[0] if len(found) == 1 else None


def read_table(wb, sheet: str) -> Table:
    ws = wb[sheet]
    last = ws.max_row  # 칸을 읽으면 openpyxl 이 빈 칸 객체를 만든다 — 크기는 읽기 전에 잰다

    def grid(lo, hi, c0, c1):
        return [tuple(r) for r in ws.iter_rows(min_row=lo, max_row=hi, min_col=c0, max_col=c1,
                                               values_only=True)] if hi >= lo else []

    rows = grid(2, last, 1, WIDTH)
    while rows and all(_blank(v) for v in rows[-1]):
        rows.pop()
    u = [i for i, (v,) in enumerate(grid(1, last, U_COL, U_COL), start=1) if not _blank(v)]
    return Table(grid(1, 1, 1, WIDTH)[0], tuple(rows), u[-1] if u else 1)


def keyed(spec: Spec, tables) -> list[dict[str, int]]:
    """표마다 {키: 행 번호(rows 의 0부터)}. 빈 행은 키를 안 만든다. 키 열을 못 찾은 표는 빈 dict."""
    sides = []
    for t in tables:
        idx = [t.col(n) for n in KEY_NAMES[spec.key]]
        rows = [] if None in idx else [i for i, r in enumerate(t.rows) if not all(_blank(v) for v in r)]
        sides.append((rows, [(t.rows[i][idx[0]], t.rows[i][idx[1]]) for i in rows]))
    lists = (number_keys if spec.key == "number" else school_keys)(*(pairs for _r, pairs in sides))
    return [dict(zip(ks, rows)) for (rows, _p), ks in zip(sides, lists)]


# ---------------------------------------------------------------- 기준 판정 열의 주인
def _read_edits(ws) -> tuple[dict, set]:
    """`_수정` → ({(시트, 키, 열): 기계 값}, {사람으로 굳은 (시트, 키, 열)}). 머리글이 다르면 둘 다 빈 것(전부 사람)."""
    rows = list(ws.iter_rows(values_only=True))
    head = [_text(h).strip() for h in rows[0]] if rows else []
    if any(h not in head for h in META_HEADER[:5]):
        return {}, set()
    ix = {h: head.index(h) for h in META_HEADER[:5]}
    machine, people = {}, set()
    for r in rows[1:]:
        get = {h: _text(r[i]) if i < len(r) else "" for h, i in ix.items()}
        where = (get["시트"], get["키"], get["열"])
        if get["구분"] == HUMAN:
            people.add(where)
        elif get["구분"] == MACHINE:
            machine[where] = get["값"]
    return machine, people


class Owners:
    """기준 판정 열 칸의 주인(결정 5). `_수정` 이 있으면 그 기록, 없으면 기준 판, 둘 다 없으면 전부 사람."""

    def __init__(self, edits: tuple[dict, set] | None = None, baseline: dict[str, Table] | None = None):
        self._edits = edits
        self._baseline = baseline or {}

    @classmethod
    def load(cls, bwb, baseline: Path | None) -> "Owners":
        if META_SHEET in bwb.sheetnames:
            return cls(edits=_read_edits(bwb[META_SHEET]))
        if baseline is None:
            return cls()
        wb = load_workbook(baseline)  # 읽기만 — 시트 목록은 안 본다(첫 판엔 06·07 이 없다)
        return cls(baseline={s: read_table(wb, s) for s, sp in SPECS.items() if sp.judged and s in wb.sheetnames})

    def human_fn(self, sheet: str, spec: Spec, bt: Table, bkeys: dict[str, int]) -> Callable[[str, str, object], bool]:
        """(원본 키, 열 이름, 원본 값) → 사람 칸인가."""
        if self._edits is not None:
            machine, people = self._edits
            return lambda k, col, v: (sheet, k, col) in people or machine.get((sheet, k, col)) != _text(v)
        base = self._baseline.get(sheet)
        if base is None:
            return lambda k, col, v: True
        # 기준 판과는 따로 잇는다 — 원본↔작업 키(쪽마다 1회 규칙)와 섞이면 기준 판에만 겹친 번호가 키를 바꾼다
        kb, kbase = keyed(spec, [bt, base])
        by_row = {i: k for k, i in kb.items()}

        def human(k, col, v) -> bool:
            j, c = kbase.get(by_row.get(bkeys.get(k))), base.col(col)
            return j is None or c is None or not _same(base.rows[j][c], v)
        return human


# ---------------------------------------------------------------- 칸 역할
def _roles(header, spec: Spec) -> list[str]:
    out = []
    for i, h in enumerate(header):
        name = base_name(h)
        out.append("rewritten" if COLUMNS[i] in REWRITTEN else "sejong" if name in spec.sejong
                   else "judged" if name in spec.judged else "person")
    return out


def _col_name(header, i: int) -> str:
    return base_name(header[i]) or f"{COLUMNS[i]}열"


def _guarded(role: str, name: str, human, k: str, v) -> bool:
    """그 칸이 값 그대로여야 하는가 — 사람 열, 또는 사람이 고친 판정 칸(비고는 덧붙이기 규칙이 따로 본다)."""
    return role == "person" or (role == "judged" and name != NOTE and human(k, name, v))


def _is_memo(role: str, name: str, human, k: str, v) -> bool:
    return not _blank(v) and (role == "person" or (role == "judged" and human(k, name, v)))


def _note_kept(before, after) -> bool:
    """after 가 before 에 덧붙인 것인가 — `번호 없음` 조각만 지울 수 있다."""
    def parts(v):
        return [p.strip() for p in _text(v).split(NOTE_SEP) if p.strip() and p.strip() != REMOVABLE_NOTE]
    keep, got = parts(before), parts(after)
    return got[:len(keep)] == keep


# ---------------------------------------------------------------- 검사
@dataclass(frozen=True)
class _Ctx:
    sheet: str
    spec: Spec
    bt: Table
    at: Table
    roles: list
    bkeys: dict
    akeys: dict
    human: Callable

    def check(self, name: str, ok: bool, detail: str) -> Check:
        return Check(label(self.sheet, name), ok, detail)


def _check_header(x: _Ctx) -> Check:
    same = len(x.bt.header) == len(x.at.header) and all(_same(b, a) for b, a in zip(x.bt.header, x.at.header))
    need = x.spec.sejong + x.spec.judged + KEY_NAMES[x.spec.key]
    missing = sorted({n for n in need if x.bt.col(n) is None})
    detail = f"머리글 {'같음' if same else '다름'}, 못 찾은 열 {len(missing)}" + (f" — {_names(missing)}" if missing else "")
    return x.check(L_HEADER, same and not missing, detail)


def _check_data(x: _Ctx, sd: dict) -> Check:
    expected = [list(r) + [None] * (WIDTH - len(r)) for r in sd.get("rows", [])]
    got = [list(r) for r in x.at.rows]

    def row_eq(i):  # 06·07 과 같은 대조 — 빈 칸 = 빈 문자열(Excel 은 빈 문자열을 빈 칸으로 쓴다)
        r, e = (got[i] if i < len(got) else []), (expected[i] if i < len(expected) else [])
        return ["" if v is None else v for v in r] == ["" if v is None else v for v in e]
    miss = next((i for i in range(max(len(got), len(expected))) if not row_eq(i)), None)
    cols_ok = list(sd.get("columns", [])) == list(COLUMNS)
    rows_ok = sd.get("beforeRows") == len(x.bt.rows)
    detail = (f"시트 {len(got)}행 / 데이터 {len(expected)}행, 원본 {len(x.bt.rows)}행 / beforeRows {sd.get('beforeRows')}"
              + (f", 첫 불일치 {miss + 2}행" if miss is not None else "") + ("" if cols_ok else ", 쓰는 열이 A~T 아님"))
    return x.check(L_DATA, miss is None and cols_ok and rows_ok, detail)


def _check_text(x: _Ctx, sd: dict) -> Check:
    letters = list(sd.get("textColumns", []))
    unknown = [c for c in letters if c not in COLUMNS]
    idx = [COLUMNS.index(c) for c in letters if c in COLUMNS]
    not_text = sum(1 for r in x.at.rows for i in idx if not _blank(r[i]) and not isinstance(r[i], str))
    detail = f"열 {len(idx)}, 텍스트 아님 {not_text}" + (f", 모르는 열 {len(unknown)}" if unknown else "")
    return x.check(L_TEXT, not unknown and not_text == 0, detail)


def _check_u(x: _Ctx, bws, aws) -> Check:
    cb = {k: v for k, v in sheet_cells(bws).items() if k[1] >= U_COL}
    ca = {k: v for k, v in sheet_cells(aws).items() if k[1] >= U_COL}
    diff = sum(1 for k in set(cb) | set(ca) if cb.get(k) != ca.get(k))
    return x.check(L_U, diff == 0, f"비교 {len(cb)}셀, 불일치 {diff}, U 끝 {x.bt.u_last}행 → {x.at.u_last}행")


def _check_person(x: _Ctx) -> Check:
    common = sorted(x.bkeys.keys() & x.akeys.keys())
    bad: collections.Counter[str] = collections.Counter()
    for k in common:
        b, a = x.bt.rows[x.bkeys[k]], x.at.rows[x.akeys[k]]
        for i, role in enumerate(x.roles):
            name = _col_name(x.bt.header, i)
            if _guarded(role, name, x.human, k, b[i]) and not _same(b[i], a[i]):
                bad[name] += 1
    n = sum(bad.values())
    return x.check(L_PERSON, n == 0, f"키 공통 {len(common)}, 불일치 {n}칸" + (f" — {_names(list(bad))}" if n else ""))


def _check_note(x: _Ctx) -> Check:
    bc, ac = x.bt.col(NOTE), x.at.col(NOTE)
    if NOTE not in x.spec.judged:
        return x.check(L_NOTE, True, "비고 열 없음")
    if bc is None or ac is None:
        return x.check(L_NOTE, False, "비고 열을 못 찾음")
    common = x.bkeys.keys() & x.akeys.keys()
    bad = sum(1 for k in common if not _note_kept(x.bt.rows[x.bkeys[k]][bc], x.at.rows[x.akeys[k]][ac]))
    return x.check(L_NOTE, bad == 0, f"키 공통 {len(common)}, 덧붙이기 아님 {bad}")


def _check_lost(x: _Ctx, sd: dict) -> Check:
    declared = set(sd.get("removed", []))
    memo, lost = 0, 0
    for k in x.bkeys.keys() - x.akeys.keys():
        b = x.bt.rows[x.bkeys[k]]
        if any(_is_memo(role, _col_name(x.bt.header, i), x.human, k, b[i]) for i, role in enumerate(x.roles)):
            memo += 1
            lost += k not in declared
    return x.check(L_LOST, lost == 0, f"빠진 행 중 메모 있음 {memo}, removed 에 없음 {lost}")


def _check_keys(x: _Ctx, sd: dict) -> Check:
    added, removed = x.akeys.keys() - x.bkeys.keys(), x.bkeys.keys() - x.akeys.keys()
    want_a, want_r = set(sd.get("added", [])), set(sd.get("removed", []))
    stay_bad = x.spec.rows_stay and bool(removed)
    detail = (f"새 {len(added)} / 데이터 {len(want_a)}, 빠짐 {len(removed)} / 데이터 {len(want_r)}"
              + (", 행을 빼지 않는 시트" if stay_bad else ""))
    return x.check(L_KEYS, added == want_a and removed == want_r and not stay_bad, detail)


def check_table(bwb, awb, sd: dict, owners: Owners | None) -> list[Check]:
    """숨김 표 payload 하나 — {kind: table, sheet, beforeRows, columns, textColumns, rows, added, removed}."""
    sheet = sd.get("sheet", "")
    spec = SPECS.get(sheet)
    if spec is None or sheet not in bwb.sheetnames or sheet not in awb.sheetnames:
        return [Check(label(sheet, L_KNOWN), False, "규칙 없음" if spec is None else "시트 없음")]
    bws, aws = bwb[sheet], awb[sheet]
    bt, at = read_table(bwb, sheet), read_table(awb, sheet)
    bkeys, akeys = keyed(spec, [bt, at])
    human = (owners or Owners()).human_fn(sheet, spec, bt, bkeys)
    x = _Ctx(sheet, spec, bt, at, _roles(bt.header, spec), bkeys, akeys, human)
    return [_check_header(x), _check_data(x, sd), _check_text(x, sd), _check_u(x, bws, aws),
            x.check(L_META, sheet_meta(bws) == sheet_meta(aws), "숨김·틀 고정·병합·조건부 서식·유효성·필터"),
            _check_person(x), _check_note(x), _check_lost(x, sd), _check_keys(x, sd)]
