/**
 * 입금 매칭 도메인 타입 — GAS autoMatchDeposits 1:1 포팅.
 * Pure function 모듈이 SharePoint 의존 없이 단독 테스트 가능하도록 시트 row를
 * 정규화된 도메인 객체로 변환하여 다룸.
 */

/** 미수채권 시트 한 행 (정규화된 도메인 객체) */
export type MisuRow = {
  /** Excel 1-based row number (PATCH cell address 계산용) */
  rowNumber: number;
  /** 청구일자 ISO yyyy-MM-dd */
  date: string;
  /** 거래처명 (정규화 전 raw) */
  customer: string;
  /** 청구금액 (원, 양수) */
  amount: number;
  /** 적요 (K열) — 비어있지 않으면 이미 처리완료 → 매칭 대상 X */
  note: string;
};

/** 입금내역 시트 한 행 */
export type DepositRow = {
  /** Excel 1-based row number */
  row: number;
  /** 거래일시 ISO yyyy-MM-dd */
  date: string;
  /** 입금금액 (원, 양수) */
  amount: number;
  /** 거래내용 (입금자명 등) */
  content: string;
  /** 미결제표시 (K열) — "처리완료"면 매칭 대상 X */
  matchedFlag: string;
};

/** 매칭 종류 — 우선순위 dispatching에 사용 */
export type MatchKind = "oneToOne" | "nToOne" | "nToM";

/** 매칭 쌍 — 미수 N건 + 입금 M건 합산 일치 */
export type MatchPair = {
  misuRows: number[];
  depRows: number[];
  kind: MatchKind;
  /** 매칭 시점의 입금일 (J열 PATCH 값 — 가장 최근 입금일) */
  depositDate: string;
  /** 합계 금액 */
  amount: number;
};

/** 금액일치/이름불일치 — admin 알림 대상 (`notifyAmountMismatch_` 대응) */
export type MismatchPair = {
  misuRow: number;
  depRow: number;
  amount: number;
  misuCustomer: string;
  depContent: string;
  misuDate: string;
  depDate: string;
};

/** 매칭 결과 묶음 */
export type MatchResult = {
  matched: MatchPair[];
  mismatches: MismatchPair[];
  /** 매칭되지 않은 미수 rowNumber */
  unmatchedMisu: number[];
  /** 매칭되지 않은 입금 row */
  unmatchedDep: number[];
};

/** 자동화 잡 실행 모드 */
export type MatchMode = "dry_run" | "live";

/** receivables_match_runs 테이블 적재용 row */
export type MatchRunRow = {
  started_at: string;
  finished_at: string;
  mode: MatchMode;
  matched_count: number;
  mismatch_count: number;
  error_count: number;
  payload: {
    matched: MatchPair[];
    mismatches: MismatchPair[];
    errors: string[];
  };
  notes: string | null;
};
