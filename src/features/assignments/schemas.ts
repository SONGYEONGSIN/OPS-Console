/**
 * 대학배정 탭이 다루는 5개 서비스 종류.
 *
 * **배열이 원천이고 타입이 파생이다.** 배정 원장의 zod 어휘가 이 배열에서 나오므로
 * (`ledger-schemas.ts`), 목록을 두 벌로 두면 같은 업무가 화면과 원장에서 다른
 * 이름을 갖는다. 팀 값이 네 곳에 흩어져 한 사람이 조용히 사라진 적이 있다.
 */
export const SERVICE_KINDS = [
  "원서접수",
  "대학원",
  "PIMS",
  "성적산출",
  "상담앱",
] as const;

export type ServiceKind = (typeof SERVICE_KINDS)[number];

/**
 * 업무종류 → 그 배정이 적히는 시트 탭.
 *
 * **중간에 들어오는 서비스의 첫 물음이 '어느 시트에 추가하나' 다.** 그 답이
 * 업무종류에서 기계적으로 나오므로 사람이 외울 것이 아니라 여기 적는다.
 *
 * `queries.ts` 의 `SHEET_NAMES` 가 이 표에서 나온다 — 시트 이름을 두 벌로 적으면
 * 한쪽만 바뀌는 날 엑셀은 멀쩡한데 화면이 없는 탭을 가리킨다.
 */
export const SERVICE_KIND_SHEETS: Record<ServiceKind, string> = {
  원서접수: "02. 배정리스트",
  대학원: "03. 대학원",
  PIMS: "04. PIMS",
  성적산출: "06. 성적산출",
  상담앱: "07. 상담앱",
};

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
  /**
   * 02 시트 현재 학년도 운영 블록의 **백업자** 칸. 운영자가 퇴사·공백일 때 대신
   * 볼 사람이라 **배정이 아니다** — `subtypes` 에 넣으면 `원서접수|백업자|운영` 이
   * 정식 배정으로 원장에 들어가 부하 집계와 제안 판정을 오염시킨다.
   */
  backupOperator?: string;
  /**
   * '담당자 변경' 칸 원문(`변경 O` / `변경 X`). 네 배정 시트에 모두 있고,
   * **직전 학년도 배정 대비 바뀌었는지**의 유일한 기록이다(2026-09-21 실측
   * `변경 O` 44건 — 02:29 · 03:3 · 04:5 · 06:7).
   *
   * 값을 해석하지 않고 원문 그대로 둔다 — 시트가 문구를 바꾸면 해석한 불리언은
   * 조용히 전부 `false` 가 되지만, 원문은 화면에서 낯선 값으로 드러난다.
   */
  assigneeChanged?: string;
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
