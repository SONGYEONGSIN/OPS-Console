"""테스트 전용 xlsx 바이트 헬퍼 — 운영 코드는 이 모듈을 import 하지 않는다.

가짜 값만 쓴다(번호 `010-0000-0001`, 학교 `테스트대학교A`, 대학 ID `9001`).
"""
import io
import zipfile
from typing import Callable

from openpyxl import Workbook

SEJONG_HEADER = ["Univ", "대학명", "번호", "비고", "등록일자"]
PIMS_HEADER = ["UnivID", "대학명", "발신번호", "파일", "등록일자", "상태", "수정", "비고"]


def make_xlsx(rows: list[list]) -> bytes:
    """첫 시트에 rows 를 그대로 적은 새 xlsx. 값 타입은 건드리지 않는다."""
    wb = Workbook()
    ws = wb.active
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def make_xlsm_like(sheets: dict[str, list[list]], vba: bytes, *,
                   setup: Callable[[Workbook], None] | None = None) -> bytes:
    """시트 이름 → 행 목록 순서대로 만든 xlsx 에 `xl/vbaProject.bin` 파트를 끼운 **테스트 전용** 파일.

    Excel 이 열 수 있을 필요는 없다 — zip 파트와 openpyxl 읽기만 흉내 낸다.
    setup 은 저장 직전 통합 문서를 받아 틀 고정·필터·숨김·이름 정의 같은 모양을 얹는다.
    """
    wb = Workbook()
    wb.remove(wb.active)
    for title, rows in sheets.items():
        ws = wb.create_sheet(title)
        for r in rows:
            ws.append(r)
    if setup is not None:
        setup(wb)
    buf = io.BytesIO()
    wb.save(buf)
    out = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(buf.getvalue())) as src, zipfile.ZipFile(out, "w") as dst:
        for info in src.infolist():
            dst.writestr(info, src.read(info.filename), compress_type=info.compress_type)
        dst.writestr("xl/vbaProject.bin", vba, compress_type=zipfile.ZIP_DEFLATED)
    return out.getvalue()
