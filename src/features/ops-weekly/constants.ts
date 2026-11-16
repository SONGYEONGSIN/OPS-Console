// 운영부 주간업무보고 상수 단일 소스 — 마이그레이션 check 절과 같은 값이다(계약 테스트가 대조).

export const OPS_WEEKLY_SLUG = "ops-weekly";
export const OPS_WEEKLY_PATH = "/dashboard/ops-weekly";

export const AREAS = ["application", "pims", "project", "tf", "leave"] as const;
export type Area = (typeof AREAS)[number];

export const AUTO_AREAS = ["application", "pims", "leave"] as const;
export type AutoArea = (typeof AUTO_AREAS)[number];

export const AREA_LABEL: Record<Area, string> = {
  application: "원서접수",
  pims: "PIMS",
  project: "프로젝트",
  tf: "TF",
  leave: "휴가·외근",
};

export const PROJECT_STAGES = [
  "기획",
  "요구분석",
  "설계",
  "개발",
  "테스트",
  "배포",
  "운영",
  "보류",
] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

export const PROJECT_KINDS = ["project", "tf"] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];

export const REPORT_STATUSES = ["draft", "submitted", "returned"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const WEEK_STATUSES = ["open", "reported"] as const;
export type WeekStatus = (typeof WEEK_STATUSES)[number];

export const WRITER_TEAMS = ["운영1팀", "운영2팀"] as const;
export const EXCLUDED_WRITER_ROLES = ["부장", "팀장"] as const;

// 사이드바 '프로젝트' 13 + 계약서·유의사항
export const SEED_PROJECT_NAMES = [
  "PIMS",
  "접수관리자",
  "내부관리자",
  "경쟁률",
  "생성툴",
  "매출 분석",
  "정산 · 진학캐쉬",
  "초중고",
  "인증",
  "대교협 연계",
  "추천인 검증",
  "보증보험",
  "실적증명",
  "계약서",
  "유의사항",
] as const;

export const OPS_WEEKLY_BUCKET = "ops-weekly";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const OPS_WEEKLY_SIGNED_URL_TTL_SEC = 3600;

// features/checklist/fill-actions.ts 의 IMAGE_RE 복제. 그쪽은 "use server" 라 비함수 export 불가, 소비처 2곳(<3)이라 추출하지 않는다.
export const OPS_WEEKLY_IMAGE_RE =
  /^data:(image\/(png|jpe?g|gif|webp));base64,([A-Za-z0-9+/=]+)$/;
