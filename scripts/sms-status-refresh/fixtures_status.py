"""테스트 전용 — 현황 파일의 숨김 시트(`_번호`·`_학교`·`_서류`)와 검색 뷰 모양. 운영 코드는 import 하지 않는다.

출처: `SMS 발신번호 사전등록/layout.py` 의 `search_sheet`·`box_span`(git 밖, 읽기만). 글꼴·테두리·
행 높이·인쇄 설정은 뺐다. 숨김 장(A~ 데이터 · P 일치 순번 수식 · S 추가 검색 글자 · T 태그 · U 고를 값 ·
이름 정의 `고를값_*`)과 보이는 장(검색 칸 병합 · `/ N건` · 유효성 · 순번 열 · INDEX 수식 · 틀 고정 ·
조건부 서식)은 원문 규칙 그대로다.

가짜 값만 쓴다(학교 `테스트대학교A`, 번호 `010-0000-0001`, 담당자 자리 `op-a`).
"""
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Font
from openpyxl.utils import get_column_letter
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.datavalidation import DataValidation

SEARCH_W = 54  # 검색 칸 너비(열 너비 합)
DATA_FIRST = 9  # 보이는 장 첫 데이터 줄

NUMBER_HEADS = [("No", 6, "C", "no"), ("학교명", 20, "L", "name"), ("구분", 10, "C", "kind"),
                ("발신번호", 16, "C", "num"), ("상태", 10, "C", "state"), ("등록일자", 12, "C", "date"),
                ("제출 서류 (10/15 기준)", 14, "C", "docs"), ("비고", 30, "L", "note")]
SCHOOL_HEADS = [("No", 6, "C", "no"), ("학교명", 20, "L", "name"), ("구분", 10, "C", "kind"),
                ("원서접수", 8, "C", "apply"), ("PIMS", 8, "C", "pims"), ("담당자", 10, "C", "owner"),
                ("등록 회선", 8, "C", "lines"), ("일괄 등록", 8, "C", "bulk"), ("추가 등록", 8, "C", "extra_n"),
                ("서류 미비", 8, "C", "missing"), ("최근 등록일", 12, "C", "recent"),
                ("제출 서류 (10/15 기준)", 14, "C", "docs"), ("확인", 10, "C", "check"), ("비고", 30, "L", "note")]
DOC_HEADS = [("No", 6, "C", "no"), ("학교명", 20, "L", "name"), ("구분", 10, "C", "kind"),
             ("등록 회선(03 번호 목록)", 10, "C", "lines"), ("세종 등록 상태", 12, "C", "state"),
             ("신청서", 6, "C", "d1"), ("위임장", 6, "C", "d2"), ("제출 상태(10/15 기준)", 14, "C", "status"),
             ("미제출 서류", 20, "L", "todo")]
PDF_COL = 18  # `_서류` R — 나중에 손으로 붙인 PDF 주소 열(세종 열도 기준 판정 열도 아니다)


def box_span(ws_w):
    """너비 합이 SEARCH_W 에 가장 가까운 연속 열 (시작 C~F, 같으면 E 에 가까운 쪽)."""
    best = None
    for start in range(3, 7):
        tot = 0
        for end in range(start, len(ws_w) + 1):
            tot += ws_w[end - 1]
            key = (abs(tot - SEARCH_W), abs(start - 5))
            if best is None or key < best[0]:
                best = (key, start, end)
            if tot > SEARCH_W:
                break
    return best[1], best[2]


def p_formula(box: str, i: int, k: int, u_last: int) -> str:
    """숨김 장 i 행 P — 검색 칸이 비었거나 U 의 값이면 T 태그로, 아니면 모든 칸에서 일부 글자 검색."""
    cols = [get_column_letter(j) for j in range(1, k + 1)] + ["S"]
    text = '&"|"&'.join(f"{c}{i}" for c in cols)
    return (f'=IF(OR({box}="",IF(ISNUMBER(MATCH({box},$U$2:$U${u_last},0)),'
            f'ISNUMBER(SEARCH("|"&{box}&"|",$T{i})),ISNUMBER(SEARCH({box},{text})))),{i - 1},"")')


def write_hidden_row(hs, i: int, heads, rec: dict, box: str, u_last: int) -> None:
    """숨김 장 한 행 — A~ 데이터, S 추가 글자, T 태그, P 수식."""
    for j, (_h, _w, _a, key) in enumerate(heads, start=1):
        v = rec.get(key, "")
        hs.cell(row=i, column=j, value=None if v == "" else v)
    hs.cell(row=i, column=19, value=rec.get("extra") or None)
    hs.cell(row=i, column=20, value="|" + "|".join(rec.get("tags", [])) + "|")
    hs.cell(row=i, column=16, value=p_formula(box, i, len(heads), u_last))


def _hidden(wb, name, hid, heads, records, picks, b0):
    hs = wb.create_sheet(hid)
    hs.sheet_state = "hidden"
    for j, (h, *_rest) in enumerate(heads, start=1):
        hs.cell(row=1, column=j, value=h)
    hs.cell(row=1, column=21, value="고를 값")
    box = f"'{name}'!${get_column_letter(b0)}$6"
    for i, rec in enumerate(records, start=2):
        write_hidden_row(hs, i, heads, rec, box, len(picks) + 1)
    for i, p in enumerate(picks, start=2):
        hs.cell(row=i, column=21, value=p)
    pick_name = "고를값_" + hid.lstrip("_").replace(" ", "")
    wb.defined_names.add(DefinedName(pick_name, attr_text=f"'{hid}'!$U$2:$U${len(picks) + 1}"))
    return hs, pick_name


def _view(wb, name, hid, heads, n, pick_name, b0, b1, rules):
    k, last = len(heads), n + 1
    ws = wb.create_sheet(name)
    ws.cell(row=1, column=1, value="SMS 발신번호 사전등록 현황: " + name.split(". ", 1)[-1])
    ws.cell(row=6, column=b0 - 1, value="🔍 검색")
    ws.merge_cells(start_row=6, start_column=b0, end_row=6, end_column=b1)
    ws.cell(row=6, column=b1 + 1, value=f'="검색 결과 "&COUNT(\'{hid}\'!$P$2:$P${last})&" / {n}건"')
    dv = DataValidation(type="list", formula1=f"={pick_name}", allow_blank=True, showErrorMessage=False)
    ws.add_data_validation(dv)
    dv.add(f"{get_column_letter(b0)}6")
    idx = get_column_letter(k + 2)  # 순번(숨김) 열 — 데이터 열 다음 한 칸 띄고
    for j, (h, *_rest) in enumerate(heads, start=1):
        ws.cell(row=8, column=j, value=h)
    ws.column_dimensions[idx].hidden = True
    for i in range(n):
        rr = DATA_FIRST + i
        ws[f"{idx}{rr}"] = f"=IFERROR(SMALL('{hid}'!$P$2:$P${last},{i + 1}),\"\")"
        for j in range(1, k + 1):
            col = get_column_letter(j)
            ws.cell(row=rr, column=j, value=f'=IF(${idx}{rr}="","",INDEX(\'{hid}\'!{col}$2:{col}${last},${idx}{rr})&"")')
    ws.freeze_panes = f"A{DATA_FIRST}"
    end = DATA_FIRST + n - 1
    for head, tmpl in rules:
        col = get_column_letter([h for h, *_ in heads].index(head) + 1)
        ws.conditional_formatting.add(f"{col}{DATA_FIRST}:{col}{end}",
                                      FormulaRule(formula=[tmpl.format(c=col, r=DATA_FIRST)], font=Font(bold=True)))
    return ws


def search_sheet(wb, name, hid, heads, records, picks, rules=(), span=None):
    """검색으로 걸러 보는 장 + 숨김 장. records 는 heads 의 키 + 'tags'·'extra'."""
    b0, b1 = span or box_span([w for _h, w, *_ in heads])
    hs, pick_name = _hidden(wb, name, hid, heads, records, picks, b0)
    ws = _view(wb, name, hid, heads, len(records), pick_name, b0, b1, rules)
    return hs, ws


def picks_of(records) -> list[str]:
    """고를 값 — 태그를 처음 나온 순서로, 중복 없이."""
    out: list[str] = []
    for rec in records:
        out += [t for t in rec.get("tags", []) if t not in out]
    return out
