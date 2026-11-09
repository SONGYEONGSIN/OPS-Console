"""테스트 전용 xlsx 바이트 헬퍼 — 운영 코드는 이 모듈을 import 하지 않는다.

가짜 값만 쓴다(번호 `010-0000-0001`, 학교 `테스트대학교A`, 대학 ID `9001`).
"""
import io

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
