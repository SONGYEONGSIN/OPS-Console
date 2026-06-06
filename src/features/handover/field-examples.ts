import type { HandoverFieldKey } from "./categories";

/**
 * 인수인계 필드별 예시 — 부산대학교 일반편입학 서비스 작성 내용.
 * 빈 필드의 placeholder(작성 가이드)로 사용한다. 실제 값이 아니라 "이렇게 적으면 된다"는 예시.
 */
export const FIELD_EXAMPLE: Record<HandoverFieldKey, string> = {
  contract_info_md: `원서접수
-형태 : 수의
-진행 : 운영자
-상태 : 완료
※ 학부 계약시 포함`,
  contract_data_md: `수시, 정시만`,
  work_basic_md: `(1) 기초
- 이전 서비스 기초를 복붙하여 다음 차수 작업 진행
- 원서 작성 시 1, 2, 3지망 선택 관련 제어
   ApplyMajor 시트 "Flag2ndMajor" 4로 설정
   SecondMajor 시트 MajorID 설정
   ▶ 1, 2, 3지망 중복하여 모집단위 선택 불가
- 국적 또는 학교소재국가 항목 UnivRefNationality 테이블 사용
- 학력사항 "출신대학명" 항목 UnivRefUniv 테이블 사용
(2) 수험번호
- 모집단위 [3자리] + 전형구분 [2자리] + 고정수 [1자리] + 차수 [1자리] + 일련번호 [3자리]
※ 수험번호 항목 "모집단위", "전형구분" 코드적용 체크
※ 수험번호 7번째 자리 차수 1자리 추가(1차 : 1 / 2차 : 2 / 3차 : 3)`,
  work_generator_md: `(1) 운영자 제어
- 제어내용 보면 알 수 있음, 궁금한 부분 있으면 문의
(2) 개발자 예외
- 특이사항 없음`,
  work_site_md: `(1) 지원자/관리자 수정페이지 제공
(2) 실명인증 사용
(3) 원서 작성(WA) 시 1, 2, 3지망 선택`,
  work_output_md: `특이사항 없음`,
  work_rate_md: `제공안함`,
  work_file_md: `(1) 전산파일 입학, 전산 각각 분리 생성
(2) 전산파일 3번
- 3번째(전형년도), 4번째(모집시기) 항목 해당 서비스에 맞게 수정 진행`,
  work_etc_md: `※ 테스트 관리자 → 수정사항 등록 진행
※ 담당 선생님과 자료요청 / 테스트 안내 메일 발송
※ 원서접수 마감 후 담당 선생님에게 마감건수 확인 통화 진행`,
  payment_fee_md: `(1) 정산진행
- 5영업일 이내
(2) 담당자
- ○○○`,
  payment_invoice_md: `청구발행`,
  school_contact_md: `(1) 실무
담당자명
000-0000-0000
contact@school.ac.kr
(2) 전산
담당자명
000-0000-0000
contact@school.ac.kr
(3) 정산
담당자명
000-0000-0000
contact@school.ac.kr`,
  docs_md: `요청없음`,
  notes_md: `없음`,
};
