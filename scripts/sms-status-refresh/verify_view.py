"""업로드 전 검사 ② — 보기 시트(01~03)·`00. 요약`·`_수정`.

숨김 표의 행 수가 바뀌면 보기 시트의 수식·조건부 서식·`/ N건` 이 새 행 수를 따라가야 한다(결정 1 — 행 범위가
`$2:$N`·CF·`/ N건`·뷰 행에 박혀 있다). 옛 범위를 보면 새 학교가 보기 화면에서 안 보이고, 줄었을 때 남은
수식이 빈 줄을 센다. `00. 요약` 은 출처 배치로 다시 쓴 값·링크(결정 8), `_수정` 은 숨김·맨 끝·이어 쓰기(결정 7).

payload `kind` 셋 — 필드 정의는 task-2-report.md:
- view    {sheet, source, rows, sourceNote}
- summary {sheet, rows, links}  — 링크 허용 대상은 원본 요약의 링크 대상에서
- meta    {sheet, rows}

detail 에는 건수·시트·셀 주소만 — 셀 값은 싣지 않는다. 통합 문서는 verify 가 읽기 전용으로 연 것을 받는다.
"""
from __future__ import annotations

import collections
import re
from typing import Sequence

from openpyxl.utils import get_column_letter, range_boundaries
from openpyxl.utils.cell import coordinate_to_tuple
from openpyxl.worksheet.worksheet import Worksheet

from verify import Check, cell_repr, sheet_cells, sheet_meta
from verify_table import META_HEADER, META_SHEET, label, read_table

HEAD_LAST = 8  # 보기 시트 머리(제목·기준 자료·검색 칸·열 이름) 마지막 행
FIRST = 9  # 보기 시트 첫 데이터 행 — 숨김 표 n 행이면 9~n+8행

L_VIEW_KNOWN = "보기 시트·숨김 표 있음"
L_RANGE = "숨김 표 참조 범위 = 새 행 수"
L_COUNT = "'/ N건' = 새 행 수"
L_ROWS = "행 수식 = 9행부터 새 행 수만큼"
L_TAIL = "데이터 뒤 빈 줄(남은 수식 없음)"
L_CF = "조건부 서식 범위 = 새 행 수"
L_TOP = "머리(1~8행)·틀 고정·병합·유효성 그대로"
CHECKS_PER_VIEW = 6
L_VIEWS = "숨김 표마다 보기 시트 검사 있음"  # 통합 문서에 하나(숨김 표 payload 가 있을 때)
L_SUMMARY_ONE = "요약 검사 정확히 1개"  # 같은 자리

L_SUM_KNOWN = "요약 시트 있음"
L_SUM_DATA = "값 = 생성 데이터(1행~)"
L_SUM_FORMULA = "수식 0"
L_SUM_LINKS = "링크 = 생성 데이터"
L_SUM_TARGET = "링크 대상은 원본 요약에 있던 곳·0 칸엔 링크 없음"
L_SUM_META = "병합·틀 고정·조건부 서식·유효성 그대로"
CHECKS_PER_SUMMARY = 5

L_META_PLACE = "숨김·맨 끝 시트"
L_META_HEADER = "머리글(1행)"
L_META_DATA = "데이터 = 생성 데이터(2행~)"
L_META_KEEP = "원본 행 그대로(이어 감)"
L_META_TEXT = "키·값 칸 전부 텍스트"
CHECKS_PER_META = 5
META_TEXT_COLS = (2, 4)  # 키·값 — Task 1 계약: 텍스트 서식(@)으로 쓴다

# 숨김 표 참조 `시트!X$2:X$N`·`'시트'!$X$2:$X$N` — 끝 행 N 을 꺼낸다
_REF = re.compile(r"(?:'(?P<q>(?:[^']|'')+)'|(?P<u>[^\s'!(),=&:\"]+))!\$?[A-Z]{1,3}\$2:\$?[A-Z]{1,3}\$(?P<end>\d+)")
_END = re.compile(r"(\$2:\$?[A-Z]{1,3}\$)\d+")
_SMALL = re.compile(r"SMALL\(([^()]*?),(\d+)\)")  # 순번 열의 k(행마다 1씩 는다)
_REL = re.compile(r"(?<![A-Za-z0-9_$])(\$?[A-Z]{1,3})(\d+)(?![\d(!])")  # 행이 상대인 참조(`$P9`)
_COUNT = re.compile(r" / (\d+)건")
_NOTE = re.compile(rf"A([1-{HEAD_LAST}])")  # sourceNote 로 허용하는 주소


def _formula(v) -> str | None:
    return v[1] if v and v[0] == "str" and isinstance(v[1], str) and v[1].startswith("=") else None


def _blank(v) -> bool:
    return v is None or v == ("str", "")


def _ends(f: str, source: str) -> list[int]:
    return [int(m["end"]) for m in _REF.finditer(f) if (m["q"] or "").replace("''", "'") == source or m["u"] == source]


def _norm_row(v, r: int):
    """행 r 의 칸을 9행과 견줄 모양으로 — 범위 끝·순번 k·상대 행을 지운다(범위 끝은 L_RANGE 가 본다)."""
    f = _formula(v)
    if f is None:
        return v
    f = _END.sub(r"\1N", f)
    f = _SMALL.sub(lambda m: f"SMALL({m[1]},[{int(m[2]) - (r - FIRST + 1)}])", f)
    return _REL.sub(lambda m: f"{m[1]}[{int(m[2]) - r}]", f)


def _by_row(cells: dict) -> dict[int, dict[int, object]]:
    out: dict[int, dict[int, object]] = collections.defaultdict(dict)
    for (r, c), v in cells.items():
        out[r][c] = v
    return out


# ---------------------------------------------------------------- 보기 시트
def _view_range(sd, af: dict, source: str, n: int) -> Check:
    ends = [e for f in af.values() for e in _ends(f, source)]
    bad = sum(1 for e in ends if e != n + 1)
    rows_ok = sd.get("rows") == n
    detail = f"참조 {len(ends)}, 끝이 {n + 1}행 아님 {bad}" + ("" if rows_ok else f", 생성 데이터 행 수 ≠ 숨김 표 {n}행")
    return Check(label(sd["sheet"], L_RANGE), bool(ends) and bad == 0 and rows_ok, detail)


def _view_count(sd, af: dict, bf: dict, source: str, n: int) -> Check:
    spots = sorted(k for k, f in af.items() if _COUNT.search(f))
    b_spots = sorted(k for k, f in bf.items() if _COUNT.search(f))
    f = af[spots[0]] if len(spots) == 1 else ""
    shown = int(_COUNT.search(f)[1]) if f else None
    ends = _ends(f, source)
    ok = spots == b_spots and len(spots) == 1 and shown == n and bool(ends) and all(e == n + 1 for e in ends)
    where = ", ".join(f"{get_column_letter(c)}{r}" for r, c in spots)
    return Check(label(sd["sheet"], L_COUNT), ok,
                 f"{len(spots)}곳 {where}, 표기 {shown}건 / 행 {n}, 범위 끝 {ends[0] if ends else '-'}")


def _view_rows(sd, acells: dict, bcells: dict, n: int) -> Check:
    tmpl = {c: _norm_row(v, FIRST) for c, v in _by_row(bcells).get(FIRST, {}).items()}
    rows = _by_row(acells)
    bad = [r for r in range(FIRST, FIRST + n) if {c: _norm_row(v, r) for c, v in rows.get(r, {}).items()} != tmpl]
    detail = f"행 {n}({FIRST}~{FIRST + n - 1}행), 어긋난 행 {len(bad)}" + (f", 첫 {bad[0]}행" if bad else "")
    return Check(label(sd["sheet"], L_ROWS), bool(tmpl) and not bad, detail)


def _view_tail(sd, acells: dict, n: int) -> Check:
    left = sorted(r for (r, _c), v in acells.items() if r >= FIRST + n and not _blank(v))
    return Check(label(sd["sheet"], L_TAIL), not left,
                 f"{FIRST + n}행부터 남은 칸 {len(left)}" + (f", 첫 {left[0]}행" if left else ""))


def _canon(rg: str, last: int | None = None) -> str:
    c0, r0, c1, r1 = range_boundaries(rg)
    r1 = last if last is not None and r0 == FIRST else r1  # 9행에서 시작하는 범위만 새 끝으로 늘인다
    return f"{get_column_letter(c0)}{r0}:{get_column_letter(c1)}{r1}"


def _cf(ws, last: int | None = None) -> collections.Counter:
    return collections.Counter(
        (" ".join(sorted(_canon(str(rg), last) for rg in cf.sqref.ranges)),
         tuple((r.type, tuple(r.formula or ())) for r in cf.rules))
        for cf in ws.conditional_formatting)


def _view_cf(sd, bws, aws, n: int) -> Check:
    expected, actual = _cf(bws, FIRST + n - 1), _cf(aws)
    off = sum(((expected - actual) + (actual - expected)).values())
    return Check(label(sd["sheet"], L_CF), expected == actual,
                 f"묶음 {sum(expected.values())} / {sum(actual.values())}, 어긋남 {off}")


def _view_top(sd, bws, aws, acells: dict, bcells: dict) -> Check:
    # 기준 자료 칸은 A열 1~8행만 면제한다 — 그 밖 주소(검색 칸·열 머리글)를 면제하면 그 칸 변경이 통과한다
    raw = sd.get("sourceNote")
    m = _NOTE.fullmatch(raw) if isinstance(raw, str) else None
    note = (int(m[1]), 1) if m else None
    skip = {k for k, v in bcells.items() if _COUNT.search(_formula(v) or "")} | {note}

    def top(cells):
        return {k: v for k, v in cells.items() if k[0] <= HEAD_LAST and k not in skip and not _blank(v)}

    diff = sum(1 for k in set(top(bcells)) | set(top(acells)) if top(bcells).get(k) != top(acells).get(k))
    nv = acells.get(note) if note else None
    note_ok = (raw is None and note is None) or (
        nv is not None and nv[0] == "str" and bool(nv[1].strip()) and _formula(nv) is None)
    mb, ma = sheet_meta(bws), sheet_meta(aws)
    keys = [k for k in mb if mb[k] != ma.get(k)]
    detail = f"머리 칸 불일치 {diff}" + (f", {'·'.join(keys)}" if keys else "") + ("" if note_ok else ", 기준 자료 칸 텍스트 아님")
    return Check(label(sd["sheet"], L_TOP), diff == 0 and not keys and note_ok, detail)


def _sheet_ok(wb, name) -> bool:
    return isinstance(name, str) and name in wb.sheetnames and isinstance(wb[name], Worksheet)


def check_view(bwb, awb, sd: dict) -> list[Check]:
    """보기 시트 하나 — 숨김 표(source)의 작업 사본 행 수 n 을 따라갔는가."""
    name, source = sd.get("sheet"), sd.get("source")
    if not all(_sheet_ok(wb, s) for wb in (bwb, awb) for s in (name, source)):
        return [Check(label(str(name), L_VIEW_KNOWN), False)]
    n = len(read_table(awb, source).rows)
    bws, aws = bwb[name], awb[name]
    bcells, acells = sheet_cells(bws), sheet_cells(aws)
    bf = {k: f for k, v in bcells.items() if (f := _formula(v))}
    af = {k: f for k, v in acells.items() if (f := _formula(v))}
    return [_view_range(sd, af, source, n), _view_count(sd, af, bf, source, n), _view_rows(sd, acells, bcells, n),
            _view_tail(sd, acells, n), _view_cf(sd, bws, aws, n), _view_top(sd, bws, aws, acells, bcells)]


def check_coverage(sheets: Sequence[dict]) -> list[Check]:
    """숨김 표를 다시 쓰면 그 보기 시트·요약도 검사에 들어와야 한다 — 빠지면 옛 값이 '대상 외 그대로' 로 통과한다.

    요약은 매 실행 다시 쓰므로(결정 8) 정확히 하나. `_수정` 은 이을 행이 없으면 안 바뀌므로 필수가 아니다.
    """
    tables = [sd["sheet"] for sd in sheets if sd.get("kind") == "table"]
    seen = {sd.get("source") for sd in sheets if sd.get("kind") == "view"}
    missing = [t for t in tables if t not in seen]
    summaries = sum(1 for sd in sheets if sd.get("kind") == "summary")
    return [Check(L_VIEWS, not missing, f"숨김 표 {len(tables)}, 보기 검사 없음 {len(missing)}"
                  + (f" — {', '.join(missing)}" if missing else "")),
            Check(L_SUMMARY_ONE, summaries == 1, f"{summaries}개")]


# ---------------------------------------------------------------- 00. 요약
def _loc(h) -> str:
    """링크 → `시트!셀`(따옴표·`#`·`$` 없이). COM(location)과 openpyxl 문자열(target `#…`) 둘 다."""
    sheet, _, cell = (h.location or h.target or "").lstrip("#").rpartition("!")
    return f"{sheet.strip(chr(39)).replace(chr(39) * 2, chr(39))}!{cell.replace('$', '')}"


def _links(ws) -> dict[str, str]:
    return {c.coordinate: _loc(c.hyperlink) for row in ws.iter_rows() for c in row if c.hyperlink is not None}


def check_summary(bwb, awb, sd: dict) -> list[Check]:
    name = sd.get("sheet")
    if not (_sheet_ok(bwb, name) and _sheet_ok(awb, name)):
        return [Check(label(str(name), L_SUM_KNOWN), False)]
    bws, aws = bwb[name], awb[name]
    acells = {k: v for k, v in sheet_cells(aws).items() if not _blank(v)}
    expected = {(r, c): cell_repr(v) for r, row in enumerate(sd.get("rows", []), start=1)
                for c, v in enumerate(row, start=1) if v not in (None, "")}
    diff = sorted(k for k in set(acells) | set(expected) if acells.get(k) != expected.get(k))
    formulas = sum(1 for v in acells.values() if _formula(v))
    links, want = _links(aws), dict(sd.get("links", {}))
    # 허용 대상 = 원본 요약의 링크 대상 — payload 가 주면 생성 쪽 실수를 스스로 인증한다
    allowed = set(_links(bws).values())
    off = [c for c, loc in links.items() if loc not in allowed]
    zero = [c for c in links if acells.get(coordinate_to_tuple(c)) in (None, ("num", 0))]
    mb, ma = sheet_meta(bws), sheet_meta(aws)
    keys = [k for k in mb if mb[k] != ma.get(k)]
    first = f", 첫 {get_column_letter(diff[0][1])}{diff[0][0]}" if diff else ""
    return [
        Check(label(name, L_SUM_DATA), not diff, f"칸 {len(acells)} / 생성 {len(expected)}, 어긋남 {len(diff)}{first}"),
        Check(label(name, L_SUM_FORMULA), formulas == 0, f"{formulas}"),
        Check(label(name, L_SUM_LINKS), links == want,
              f"링크 {len(links)} / 생성 {len(want)}, 어긋남 {len(set(links.items()) ^ set(want.items()))}"),
        Check(label(name, L_SUM_TARGET), not off and not zero, f"원본에 없던 대상 {len(off)}, 0·빈 칸 링크 {len(zero)}"),
        Check(label(name, L_SUM_META), not keys, "·".join(keys)),
    ]


# ---------------------------------------------------------------- _수정
def _meta_rows(ws) -> list[tuple]:
    last, width = ws.max_row, len(META_HEADER)  # 크기는 읽기 전에 잰다
    rows = [tuple(r) for r in ws.iter_rows(min_row=1, max_row=last, max_col=width, values_only=True)]
    while rows and all(v in (None, "") for v in rows[-1]):
        rows.pop()
    return rows


def _same_rows(a: Sequence[Sequence], b: Sequence[Sequence]) -> bool:
    def norm(rows):
        return [[None if v == "" else cell_repr(v) for v in (list(r) + [None] * len(META_HEADER))[:len(META_HEADER)]]
                for r in rows]
    return norm(a) == norm(b)


def check_meta(bwb, awb, sd: dict) -> list[Check]:
    """`_수정` — 숨김·맨 끝(결정 7), 머리글, 생성 데이터, 원본 행 이어 쓰기, 키·값 텍스트(Task 1 계약)."""
    name = sd.get("sheet")
    if name != META_SHEET or not _sheet_ok(awb, name):
        return [Check(label(META_SHEET, L_META_PLACE), False, "시트 없음")]
    aws = awb[name]
    rows = _meta_rows(aws)
    data = rows[1:]
    old = _meta_rows(bwb[name])[1:] if _sheet_ok(bwb, name) else []
    not_text = sum(1 for r in data for i in META_TEXT_COLS if r[i] not in (None, "") and not isinstance(r[i], str))
    return [
        Check(label(name, L_META_PLACE), awb.sheetnames[-1] == name and aws.sheet_state == "hidden",
              f"{awb.sheetnames.index(name) + 1}/{len(awb.sheetnames)}번째, {aws.sheet_state}"),
        Check(label(name, L_META_HEADER), rows[:1] == [META_HEADER], f"{len(META_HEADER)}칸"),
        Check(label(name, L_META_DATA), _same_rows(data, sd.get("rows", [])),
              f"시트 {len(data)}행 / 생성 {len(sd.get('rows', []))}행"),
        Check(label(name, L_META_KEEP), _same_rows(data[:len(old)], old), f"원본 {len(old)}행"),
        Check(label(name, L_META_TEXT), not_text == 0, f"텍스트 아님 {not_text}"),
    ]


CHECKERS = {"view": check_view, "summary": check_summary, "meta": check_meta}
