/**
 * services 도메인 enum 옵션 — prod 2511행 실 데이터 unique 값 분석 기반.
 * EditForm select / 필터 select에서 재사용.
 *
 * 신규 카테고리 등 enum 확장 시 본 파일 + (도입 시) DB CHECK 제약 동시 갱신.
 * 현재 DB는 자유 텍스트 (1차 PR 정책)이므로 별도 마이그레이션 불필요.
 */

export const APPLICATION_TYPE_OPTIONS = [
  "공통원서",
  "반응형원서",
  "일반원서",
  "일반접수",
] as const;

export const REGION_OPTIONS = [
  "서울",
  "경기",
  "인천",
  "강원",
  "충북",
  "충남",
  "대전",
  "세종",
  "전북",
  "전남",
  "광주",
  "경북",
  "경남",
  "대구",
  "울산",
  "부산",
  "제주",
] as const;

export const UNIVERSITY_TYPE_OPTIONS = [
  "4년제",
  "2년제",
  "전문대",
  "대학원",
  "초중고교",
  "학위취득",
  "기타",
] as const;

export const CATEGORY_OPTIONS = [
  "정시",
  "수시",
  "재외국민",
  "편입",
  "추가",
  "단계별 접수",
  "자율화전형",
  "특수대학교",
  "대학원",
  "초중고교",
  "학위취득",
  "기타",
] as const;
