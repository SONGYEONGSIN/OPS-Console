"""업로드 전 검사 — 06·07 을 다시 쓴 작업 사본에서 **06·07 말고는 아무것도 바뀌지 않았는가.**

사람이 쓴 칸을 지키는 마지막 방어선이다. 하나라도 실패하면 다음 단계가 업로드를 막는다.

출처: `SMS 발신번호 사전등록/moa_compare.py` 의 `cell_repr`·`sheet_cells`·`raw_defined_names`·
`names_of`·`sheet_meta`·`cmd_verify`. 바뀐 것:
- 새 시트 1개 추가가 아니라 **같은 자리 교체**: 대상 시트가 원본에 있었으면 시트 목록이 원본과 같아야 한다.
- 매크로는 크기가 아니라 바이트 sha256 이 같아야 한다(복원 뒤에 부른다).
- VBA 모듈 검사를 생략하지 않는다. 모듈을 하나도 못 읽어도 실패다.
- workbook.xml 이름 정의는 '원본 ⊆ 작업' 이 아니라 **차집합 양쪽**이 대상 시트의 필터 범위뿐이어야 한다
  (교체하면 옛 필터 범위가 빠지고 새 범위가 들어온다).
- 데이터 비교는 헤더 너비가 아니라 시트에 실제로 있는 칸 전부를 보고, 중간의 빈 행도 불일치로 친다.
- 출력 대신 `Check` 목록을 돌려준다. detail 에는 건수·시트 이름·행 번호만 — 셀 값은 싣지 않는다.

통합 문서는 openpyxl 로 **읽기만** 한다.
"""
from __future__ import annotations

import collections
import datetime as dt
import hashlib
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Sequence

from openpyxl import load_workbook
from openpyxl.worksheet.formula import ArrayFormula, DataTableFormula
from openpyxl.worksheet.worksheet import Worksheet

from vba import vba_module_hashes, vba_part

LABEL_TARGETS = "대상 시트 지정"
LABEL_SHEETS = "시트 목록(이름·숨김·순서)"
LABEL_VBA_EXISTS = "vbaProject.bin 존재"
LABEL_VBA_HASH = "vbaProject.bin 바이트 sha256 동일"
LABEL_MODULES = "VBA 모듈 소스 동일"
LABEL_NAMES = "이름 정의 그대로"
LABEL_RAW_NAMES = "workbook.xml 이름 정의: 차이는 대상 시트 필터 범위뿐"
LABEL_CELLS = "대상 외 시트 셀(값·수식 문자열) 불일치 0"
LABEL_META = "대상 외 시트 틀 고정·병합·조건부 서식·유효성 그대로"

FILTER_NAME = "_xlnm._FilterDatabase"
_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
_NAMES_SHOWN = 5  # detail 에 적는 시트 이름 수 상한 — 결과 한 줄 300자를 넘기지 않게


@dataclass(frozen=True)
class Check:
    label: str
    ok: bool
    detail: str = ""  # 건수·시트 이름만 — 셀 값 금지


def failed_labels(checks: Sequence[Check]) -> list[str]:
    return [c.label for c in checks if not c.ok]


# ---------------------------------------------------------------- 읽기 (원본 이식)
def cell_repr(v):
    """비교용 값 — 타입까지 본다(번호 '0101…' 문자열 ↔ 숫자 101… 은 다르다)."""
    if v is None:
        return None
    if isinstance(v, ArrayFormula):
        return ("array", v.ref, v.text)
    if isinstance(v, DataTableFormula):
        return ("table", tuple(sorted((k, str(x)) for k, x in vars(v).items())))
    if isinstance(v, (dt.datetime, dt.date, dt.time)):
        return ("dt", v.isoformat())
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return ("num", v)
    return (type(v).__name__, v)


def sheet_cells(ws) -> dict[tuple[int, int], object]:
    return {(c.row, c.column): cell_repr(c.value) for row in ws.iter_rows() for c in row if c.value is not None}


def sheet_meta(ws) -> dict:
    if not isinstance(ws, Worksheet):  # 차트 시트에는 셀·틀 고정이 없다
        return {"state": ws.sheet_state}
    return {"state": ws.sheet_state, "freeze": ws.freeze_panes,
            "merged": sorted(str(m) for m in ws.merged_cells.ranges),
            "cf": len(ws.conditional_formatting), "dv": len(ws.data_validations.dataValidation),
            "autofilter": ws.auto_filter.ref}


def names_of(wb) -> dict[str, tuple]:
    """이름 → (참조, 범위 시트 이름, 숨김). localSheetId 는 번호 대신 그 시트 이름으로 푼다 —
    07 이 처음 끼어드는 실행에서 뒤 시트 번호가 밀려 거짓 실패가 나지 않게."""
    def scope(lid):
        return wb.sheetnames[lid] if isinstance(lid, int) and 0 <= lid < len(wb.sheetnames) else lid

    out = {n: (d.attr_text, scope(d.localSheetId), d.hidden) for n, d in wb.defined_names.items()}
    for ws in wb.worksheets:
        out.update({f"{ws.title}!{n}": (d.attr_text, scope(d.localSheetId), d.hidden)
                    for n, d in ws.defined_names.items()})
    return out


def raw_defined_names(path: Path) -> tuple[list[str], set[tuple]]:
    """workbook.xml 의 시트 이름 목록과 definedName 전부 {(이름, 범위 시트명|workbook, 숨김, 참조)}.

    localSheetId 는 시트명으로 푼다 — 시트가 끼어들어 번호가 밀려도 같은 이름이면 같게 본다.
    """
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("xl/workbook.xml"))
    sheets = [s.get("name", "") for s in root.iter(f"{_NS}sheet")]
    out = set()
    for d in root.iter(f"{_NS}definedName"):
        lid = d.get("localSheetId")
        if lid is None:
            scope = "workbook"
        elif lid.isdigit() and int(lid) < len(sheets):
            scope = sheets[int(lid)]
        else:
            scope = f"?{lid}"  # 범위를 못 푸는 이름 — 어느 쪽 집합에도 같게 맞지 않으면 차이로 잡힌다
        out.add((d.get("name", ""), scope, d.get("hidden") in ("1", "true"), d.text or ""))
    return sheets, out


def _names(titles: Sequence[str]) -> str:
    shown = ", ".join(titles[:_NAMES_SHOWN])
    return shown + (f" 외 {len(titles) - _NAMES_SHOWN}" if len(titles) > _NAMES_SHOWN else "")


def _sheet_list(wb) -> list[tuple[str, str]]:
    return [(t, wb[t].sheet_state) for t in wb.sheetnames]


# ---------------------------------------------------------------- 1. 시트 목록
def expected_sheet_list(before: list[tuple[str, str]], sheets: Sequence[dict]) -> list[tuple[str, str]] | None:
    """excel_apply.ps1 의 결과로 기대하는 시트 목록. 있던 대상은 제자리, 없던 대상은 afterSheet 바로 뒤.

    시트 dict 순서대로 넣는다(07 은 방금 만든 06 뒤). afterSheet 가 없으면 None.
    """
    out = list(before)
    for sd in sheets:
        titles = [t for t, _ in out]
        if sd["sheet"] in titles:
            continue
        if sd["afterSheet"] not in titles:
            return None
        out.insert(titles.index(sd["afterSheet"]) + 1, (sd["sheet"], "visible"))
    return out


def _check_sheet_list(bwb, awb, sheets: Sequence[dict]) -> Check:
    b_list, a_list = _sheet_list(bwb), _sheet_list(awb)
    expected = expected_sheet_list(b_list, sheets)
    hidden = sum(1 for _, s in a_list if s != "visible")
    return Check(LABEL_SHEETS, expected is not None and a_list == expected,
                 f"원본 {len(b_list)} → 작업 {len(a_list)}, 숨김 {hidden}")


# ---------------------------------------------------------------- 2~4. 매크로
def _check_vba(before: Path, after: Path, module_hashes: Callable[[Path], dict[str, str]]) -> list[Check]:
    vb, va = vba_part(before), vba_part(after)
    exists = vb is not None and va is not None
    same = exists and vb[0] == va[0] and hashlib.sha256(vb[1]).digest() == hashlib.sha256(va[1]).digest()
    size = f"{len(vb[1])} / {len(va[1])} bytes" if exists else ""
    # 모듈 소스 — 못 읽으면(ImportError 등) 예외가 그대로 올라가 단계가 실패한다
    hb, ha = module_hashes(before), module_hashes(after)
    return [
        Check(LABEL_VBA_EXISTS, exists, f"원본 {'있음' if vb else '없음'} / 작업 {'있음' if va else '없음'}"),
        Check(LABEL_VBA_HASH, same, size),
        Check(LABEL_MODULES, bool(hb) and hb == ha, f"모듈 {len(hb)} / {len(ha)}"),
    ]


# ---------------------------------------------------------------- 5~6. 이름 정의
def _check_names(before: Path, after: Path, bwb, awb, targets: set[str]) -> list[Check]:
    nb, na = names_of(bwb), names_of(awb)
    sb, xb = raw_defined_names(before)
    sa, xa = raw_defined_names(after)
    diff = xa ^ xb
    only_filters = all(n == FILTER_NAME and scope in targets for n, scope, _, _ in diff)
    return [
        Check(LABEL_NAMES, nb == na, f"원본 {len(nb)} / 작업 {len(na)}"),
        Check(LABEL_RAW_NAMES, bool(sb) and bool(sa) and only_filters,
              f"원본 {len(xb)} / 작업 {len(xa)} (빠짐 {len(xb - xa)}, 추가 {len(xa - xb)})"),
    ]


# ---------------------------------------------------------------- 7~8. 대상 외 시트
def _check_untouched(bwb, awb, targets: set[str]) -> list[Check]:
    total, diff = 0, 0
    cell_bad: list[str] = []
    meta_bad: list[str] = []
    for title in bwb.sheetnames:
        if title in targets:
            continue
        b = bwb[title]
        a = awb[title] if title in awb.sheetnames else None
        cb = sheet_cells(b) if isinstance(b, Worksheet) else {}
        ca = sheet_cells(a) if isinstance(a, Worksheet) else {}
        d = sum(1 for k in set(cb) | set(ca) if cb.get(k) != ca.get(k))
        total += len(cb)
        diff += d
        if d or a is None:
            cell_bad.append(title)
        if a is None or sheet_meta(b) != sheet_meta(a):
            mb, ma = sheet_meta(b), sheet_meta(a) if a is not None else {}
            keys = [k for k in mb if mb[k] != ma.get(k)]
            meta_bad.append(f"{title}({'·'.join(keys)})")
    cell_detail = f"비교 {total}셀, 불일치 {diff}" + (f" — {_names(cell_bad)}" if cell_bad else "")
    return [
        Check(LABEL_CELLS, not cell_bad, cell_detail),
        Check(LABEL_META, not meta_bad, _names(meta_bad)),
    ]


# ---------------------------------------------------------------- 9. 대상 시트
def _norm(v):
    return "" if v is None else v


def _data_rows(ws, first: int, width: int, last: int) -> list[list]:
    """first~last 행의 값(너비 width). 끝의 빈 행만 떼고 중간 빈 행은 남긴다 — 그것도 불일치다."""
    rows = [list(r) for r in ws.iter_rows(min_row=first, max_row=last, max_col=width, values_only=True)] \
        if last >= first else []
    while rows and all(v in (None, "") for v in rows[-1]):
        rows.pop()
    return rows


def _first_mismatch(rows: list[list], expected: list[list], first: int) -> int | None:
    for i in range(max(len(rows), len(expected))):
        r = rows[i] if i < len(rows) else []
        e = expected[i] if i < len(expected) else []
        if [_norm(x) for x in r] != [_norm(x) for x in e]:
            return first + i
    return None


def _sum_check(label: str, cnt: dict, a: str, b: str, total: str) -> Check:
    va, vb, vt = cnt.get(a), cnt.get(b), cnt.get(total)
    ok = all(isinstance(v, int) for v in (va, vb, vt)) and va + vb == vt
    return Check(label, ok, f"{va}+{vb} = {vt}")


def _count_formulas(ws) -> int:
    return sum(1 for row in ws.iter_rows() for c in row
               if isinstance(c.value, (ArrayFormula, DataTableFormula))
               or (isinstance(c.value, str) and c.value.startswith("=")))


def _check_layout(ws, sd: dict, rows: list[list], width: int) -> list[Check]:
    """헤더 · 데이터 · 발신번호 텍스트 · 수식 0."""
    name, header = sd["sheet"], list(sd["header"])
    hr, first = int(sd["headerRow"]), int(sd["firstDataRow"])
    hdr = next(ws.iter_rows(min_row=hr, max_row=hr, max_col=width, values_only=True))
    hdr_ok = list(hdr[:len(header)]) == header and all(v is None for v in hdr[len(header):])
    expected = [list(r) + [None] * (width - len(r)) for r in sd["rows"]]
    miss = _first_mismatch(rows, expected, first)
    phone = header.index("발신번호") if "발신번호" in header else None
    not_text = -1 if phone is None else sum(
        1 for r in rows if r[phone] not in (None, "") and not isinstance(r[phone], str))
    formulas = _count_formulas(ws)
    return [
        Check(f"{name}: 헤더({hr}행)", hdr_ok, f"{len(header)}칸"),
        Check(f"{name}: 데이터 = 생성 데이터(셀 단위)", miss is None,
              f"시트 {len(rows)}행 / 데이터 {len(expected)}행" + (f", 첫 불일치 {miss}행" if miss else "")),
        Check(f"{name}: 발신번호 칸 전부 텍스트", not_text == 0,
              "헤더에 발신번호 없음" if phone is None else f"텍스트 아님 {not_text}"),
        Check(f"{name}: 수식 0", formulas == 0, f"{formulas}"),
    ]


def _check_target(ws, sd: dict) -> list[Check]:
    """대상 시트 하나 — excel_apply.ps1 이 만드는 모양(헤더 8행 · 데이터 9행~ · 틀 고정 · 자동 필터)."""
    name, order, other, cnt = sd["sheet"], list(sd["order"]), sd["other"], dict(sd["counts"])
    hr, first = int(sd["headerRow"]), int(sd["firstDataRow"])
    # 칸을 읽으면 openpyxl 이 빈 칸 객체를 만든다 — 크기는 읽기 전에 잰다
    width, last = max(len(sd["header"]), ws.max_column), ws.max_row
    rows = _data_rows(ws, first, width, last)
    c = collections.Counter(r[1] for r in rows)
    ref = ws.auto_filter.ref or ""
    return _check_layout(ws, sd, rows, width) + [
        _sum_check(f"{name}: 양쪽+세종만 = 세종 고유", cnt, "양쪽", "세종만", "세종 고유"),
        _sum_check(f"{name}: 양쪽+{other}만 = {other} 고유", cnt, "양쪽", f"{other}만", f"{other} 고유"),
        Check(f"{name}: 분류 건수 = 생성 데이터", all(c[k] == cnt.get(k) for k in order),
              ", ".join(f"{k} {c[k]}/{cnt.get(k)}" for k in order)),
        Check(f"{name}: 틀 고정 A{first}", ws.freeze_panes == f"A{first}", str(ws.freeze_panes)),
        Check(f"{name}: 자동 필터 A{hr}:", ref.startswith(f"A{hr}:"), ref),
    ]


# ---------------------------------------------------------------- 진입점
def verify_workbook(before: Path, after: Path, sheets: Sequence[dict], *,
                    module_hashes: Callable[[Path], dict[str, str]] = vba_module_hashes) -> list[Check]:
    """원본(before)과 매크로를 복원한 작업 사본(after)을 대조한 검사 목록. 하나라도 ok=False 면 올리지 않는다."""
    bwb = load_workbook(before, keep_vba=True)
    awb = load_workbook(after, keep_vba=True)
    try:
        targets = {sd["sheet"] for sd in sheets}
        # 대상이 비면 9번 검사가 통째로 빠진 채 통과한다 — 빈 목록은 그 자체로 실패
        checks = [Check(LABEL_TARGETS, bool(sheets), f"{len(sheets)}장"),
                  _check_sheet_list(bwb, awb, sheets)]
        checks += _check_vba(before, after, module_hashes)
        checks += _check_names(before, after, bwb, awb, targets)
        checks += _check_untouched(bwb, awb, targets)
        for sd in sheets:
            if sd["sheet"] in awb.sheetnames and isinstance(awb[sd["sheet"]], Worksheet):
                checks += _check_target(awb[sd["sheet"]], sd)
            else:
                checks.append(Check(f"{sd['sheet']}: 시트 있음", False))
        return checks
    finally:
        # keep_vba 가 메모리에 연 zip — 닫지 않으면 GC 때 '닫힌 파일' 경고가 난다
        for wb in (bwb, awb):
            if wb.vba_archive is not None:
                wb.vba_archive.close()
