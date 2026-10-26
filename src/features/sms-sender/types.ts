export const HIDDEN_SHEETS = {
  schools: "_학교",
  docs: "_서류",
  numbers: "_번호",
  checks: "_확인",
} as const;
export type HiddenSheetKey = keyof typeof HIDDEN_SHEETS;
export const CRITERIA_SHEET = "05. 제출 서류 기준";
export const SMS_ROOT_PATH = "내부관리자/01. SMS 발신번호 사전등록";
export const DOCS_FOLDER = "03. 학교별 제출 서류";
export const DOC_KINDS = [
  "신청서",
  "위임장",
  "이용증명원",
  "사업자등록증",
  "법인인감",
  "재직증명서",
  "신분증",
  "위탁계약서",
] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export type Completeness = "완비" | "미비" | "확인 안 됨";
export type Stage = "제출완료" | "검토완료" | "진행 중" | "기타";
export type DriveFile = {
  id: string;
  name: string;
  webUrl: string;
  size: number;
  lastModifiedDateTime: string;
};
/** DOCS_FOLDER 아래 상대 경로, 예 "완료/제출완료/접수+PIMS" */
export type RawPdf = DriveFile & { folder: string };
export type RawSource = {
  workbook: DriveFile;
  offRuleFiles: string[];
  sheets: Record<HiddenSheetKey, unknown[][]>;
  criteria: unknown[][] | null;
  pdfs: RawPdf[];
  fetchedAt: string;
};
export type SchoolRow = {
  no: number;
  name: string;
  gubun: string;
  apply: boolean;
  pims: boolean;
  lines: number;
  bulk: number;
  added: number;
  deficient: number;
  lastRegisteredAt: string | null;
  docSummary: string;
  needsCheck: boolean;
  note: string;
};
export type DocStatus = {
  sejongStatus: string;
  marks: Record<DocKind, string>;
  submitState: string;
  completeness: Completeness;
  missing: string;
};
export type PdfCopy = {
  fileName: string;
  folder: string;
  stage: Stage;
  sub: string | null;
  webUrl: string;
  lastModifiedDateTime: string;
};
/** pdfs: 앞선 단계 먼저, [] = PDF 없음 */
export type School = SchoolRow & { docs: DocStatus | null; pdfs: PdfCopy[] };
export type SenderNumber = {
  no: number;
  school: string;
  gubun: string;
  number: string;
  digits: string;
  status: string;
  registeredAt: string | null;
  docs: string;
  note: string;
  schoolNo: number | null;
};
export type CheckItem = {
  no: number;
  kind: string;
  target: string;
  content: string;
  basis: string;
  todo: string;
  schoolNo: number | null;
};
export type SmsSenderData = {
  workbook: DriveFile;
  fetchedAt: string;
  offRuleFiles: string[];
  schools: School[];
  numbers: SenderNumber[];
  checks: CheckItem[];
  unmatchedPdfs: string[];
  criteria: string[][] | null;
};
