"""현황 파일 본체 시트 이름 — PR-3b 의 계산(T6·T11·T12·T14)과 검사(verify_view)가 이 한 곳을 import 한다.

이름은 출처 `build_xlsx.py` 의 S_SCHOOL·S_CHK·S_NUM 그대로다(02 는 '학교별 제출 서류'). 이 모듈은 아무것도
import 하지 않는다 — verify_view 와 sheet_table 이 서로를 부르지 않고 같은 이름을 쓰게 하려고 따로 둔다.
"""

VIEW_OF = {"01. 학교별 현황": "_학교", "02. 학교별 제출 서류": "_서류", "03. 번호 목록": "_번호"}  # 보기 시트 → 숨김 표
SUMMARY_SHEET = "00. 요약"
ISSUE_VIEW = "04. 확인 필요"  # 안 만지는 장(결정 8) — 요약 링크 대상으로만 쓴다
