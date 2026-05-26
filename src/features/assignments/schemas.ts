/** 대학배정 탭이 다루는 5개 서비스 종류 */
export type ServiceKind =
  | "원서접수"
  | "대학원"
  | "PIMS"
  | "성적산출"
  | "상담앱";

export const SERVICE_KINDS: ServiceKind[] = [
  "원서접수",
  "대학원",
  "PIMS",
  "성적산출",
  "상담앱",
];

/** 한 시트의 한 행에서 추출한 단일 서비스 배정 (그리드 대표값) */
export type AssignmentRecord = {
  university: string;
  service: ServiceKind;
  /** 02. 배정리스트 B열 '대분류' (예: 4년제 / 전문대학 / 초중고 / 폴리텍). baejung에서만 채워짐. */
  universityType?: string;
  /** 그리드 대표 운영자 (원서접수=수시 기준) */
  operator: string;
  /** 그리드 대표 개발자. PIMS 등 개발자 없으면 "" */
  developer: string;
  /** 인스펙터용 상세 항목 (sub-type/연도/보조 컬럼) */
  detail: AssignmentDetail[];
  /** 원서접수(학부) 2027 하위유형별 운영/개발 (데이터 있는 것만, 시트 컬럼 순서). 그리드 셀 표시용. */
  subtypes?: { label: string; operator: string; developer: string }[];
};

/** 인스펙터에 한 줄로 표시할 상세 (예: "2027 수시 운영", "기자의") */
export type AssignmentDetail = { label: string; value: string };

/** 대학 1행 = 5서비스 배정 묶음 (조인 결과) */
export type UnivAssignmentRow = {
  university: string;
  /** B열 '대분류' (baejung 행에서 join 시 유지). 다른 시트만 있는 대학은 undefined. */
  universityType?: string;
  /** service → 해당 서비스 배정 (없으면 키 없음) */
  byService: Partial<Record<ServiceKind, AssignmentRecord>>;
};

/** Graph usedRange 파싱 결과 (raw 그리드 + 헤더) */
export type AssignmentSheet = {
  worksheetName: string;
  /** display text 2차원 배열 (헤더 포함 전체 행) */
  rowsText: string[][];
  rowCount: number;
  columnCount: number;
};
