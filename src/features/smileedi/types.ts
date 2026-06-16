/**
 * SmileEDI 세금계산서 메일 자동화 도메인 타입.
 * 원본: docs/SmileEdi/Tax_invoice.py (header row3 엑셀 → 조건부 담당자 메일).
 */

/** SharePoint 역발행 세금계산서 시트의 한 행 (필요 컬럼만 파싱, 1-based excelRow 보존). */
export type SmileEdiRow = {
  /** 시트 1-based 행 번호 (이메일오류 PATCH 주소 계산용) */
  excelRow: number;
  writeDate: string; // 작성일자
  item: string; // 품목
  supplyAmount: string; // 공급가액 (원본 문자열, 표시/합계 시 숫자화)
  taxAmount: string; // 세액
  companyName: string; // 거래처명
  receiverDept: string; // 담당부서-공급받는자
  contactName: string; // 담당자명-공급받는자
  contactPhone: string; // 담당자연락처-공급받는자
  contactEmail: string; // 공급받는자이메일
  supplierManager: string; // 담당자명-공급자
  approvalNumber: string; // 승인번호
  emailError: string; // 이메일오류 ('Y'면 발송 제외)
  status: string; // 상태 ('승인'이면 발송 제외, '미승인'만 발송)
};

/** env에서 파싱해 주입하는 매핑/필터 설정 (파일 시스템 접근 금지 — 순수 입력). */
export type SmileEdiMappingConfig = {
  /** 품목키워드 (행 내 임의 컬럼에 하나라도 포함되면 통과) */
  itemKeywords: string[];
  /** 거래처명 → 담당자명 기본 매핑 (get_manager_by_rules의 company_manager_map) */
  companyManager: Record<string, string>;
  /** 담당자명 → 수신 이메일 */
  managerEmail: Record<string, string>;
  /** 규칙·매핑 미매치 시 기본 담당자명 (원본 폴백 '송영신') */
  defaultManager: string;
  /** 모든 메일 공통 CC (받는사람과 중복 시 제외). 미설정 시 빈 배열. */
  cc?: { email: string; name: string }[];
};

/** 담당자별로 묶인 발송 그룹. */
export type SmileEdiGroup = {
  managerName: string;
  recipientEmail: string;
  rows: SmileEdiRow[];
  /** 규칙/매핑 미매치라 기본 담당자로 라우팅됐는지 (신규 거래처 리포트용) */
  routedByDefault: boolean;
};

/** 그룹핑 결과 — 발송 그룹 + 수신 이메일 미해결로 제외된 항목. */
export type SmileEdiGrouping = {
  groups: SmileEdiGroup[];
  /** 담당자명은 정해졌으나 managerEmail 매핑이 없어 발송 불가한 거래처명들 */
  unresolvedManagers: { managerName: string; companyNames: string[] }[];
};

/** 그룹 1건 발송 결과 (이력 적재 단위). */
export type SmileEdiSendResult = {
  managerName: string;
  recipientEmail: string;
  companyNames: string[];
  invoiceCount: number;
  totalSupplyAmount: number;
  status: "sent" | "failed" | "dry_run";
  graphMessageId?: string;
  errorMessage?: string;
};
