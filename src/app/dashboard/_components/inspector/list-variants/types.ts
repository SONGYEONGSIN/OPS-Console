import type { Dispatch, SetStateAction } from "react";
import type { ListRow } from "../../patterns/ListPattern";
import type { OperatorPermission } from "@/features/operators/schemas";

export type Variant =
  | "default"
  | "team"
  | "post-feedback"
  | "post-notice"
  | "schedule"
  | "my-todo"
  | "weekly-todo"
  | "project"
  | "project-task"
  | "cohort"
  | "receivables"
  | "ai-work"
  | "ai-tips"
  | "backup"
  | "services"
  | "contracts"
  | "contacts"
  | "incidents"
  | "incident-reports"
  | "meetings"
  | "handover"
  | "assignments"
  | "worklog"
  | "data-request"
  | "dev-test"
  | "performance";

/** cohort variant — 온보딩 체크리스트 토글 server action 입력. */
export type ChecklistToggleInput = {
  cohort_id: string;
  section_key: string;
  item_key: string;
  checked: boolean;
};

export type ViewProps = {
  row: ListRow;
  currentUserPermission?: OperatorPermission | null;
  receivablesMailDryRun?: boolean;
  /** cohort variant — 인스펙터 내 체크리스트 토글 (없으면 읽기 전용). */
  onChecklistToggle?: (
    input: ChecklistToggleInput,
  ) => Promise<{ ok: boolean; error?: string }>;
};

export type EditFormProps = {
  row: ListRow;
  setRow: Dispatch<SetStateAction<ListRow>>;
  onSave: (next: ListRow) => void;
  onCancel: () => void;
  /** team variant — 권한 select admin only 분기 */
  currentUserPermission?: OperatorPermission | null;
  /** incidents variant — 본인 작성건 삭제 권한 가드 (admin은 무관, member는 본인 건만) */
  currentUserEmail?: string | null;
  /** incidents variant — 담당부서 자동 고정용 (operators.team: '운영1팀' | '운영2팀') */
  currentUserTeam?: string | null;
  /** backup variant — 제목 자동입력용 요청자(운영자) 이름 */
  currentUserName?: string | null;
  /** cohort variant — 초대 메일 발송 */
  onInvite?: (id: string) => Promise<{ ok: boolean; error?: string }>;
  /** receivables variant — 적요 PATCH */
  onUpdateRemarks?: (
    row: ListRow,
    newText: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** backup variant — 백업자 후보 (active operators, 본인 제외) */
  backupOperators?: { email: string; name: string }[];
  /** backup variant — 담당 서비스 후보 (services 카탈로그 light fields) */
  backupServiceCandidates?: {
    id: string;
    service_id: number;
    service_name: string;
    university_name: string;
  }[];
  /** backup variant — 대학 연락처 후보 (contacts 마스터 light fields). PR-5: email/phone 추가 — 메일/PDF 본문 노출용. ext(내선)도 함께 스냅샷. */
  backupContactCandidates?: {
    id: string;
    customer_name: string;
    university_name: string;
    email: string | null;
    phone: string | null;
    ext: string | null;
  }[];
  /** contacts variant — 대학명 자동완성 후보 (services.universityName distinct) */
  universityNameSuggestions?: readonly string[];
  /** services variant — 운영자·개발자 후보 (operators 마스터, active) */
  servicesOperators?: { email: string; name: string }[];
  /** services variant — 대학명 → 학교키·다음 시퀀스 매핑 (자동 service_id 부여용) */
  servicesUniversityKeys?: {
    universityName: string;
    key: number;
    nextSeq: number;
  }[];
  /** incidents variant — 대학명 자동완성 후보 (services.university_name distinct) */
  incidentUniversityNameSuggestions?: readonly string[];
  /** incidents variant — 서비스 후보 (대학명 + 서비스명) — 선택 대학으로 필터 검색 */
  incidentServiceOptions?: readonly { university: string; name: string }[];
  /** incidents variant — 카테고리 자동완성 후보 (자주 쓰는 값 datalist) */
  incidentCategorySuggestions?: readonly string[];
  /** contracts variant — 계약진행현황 / 서비스여부 datalist 옵션 (실 데이터 distinct) */
  contractsStatusOptions?: readonly string[];
  contractsServiceActiveOptions?: readonly string[];
  /** handover variant — 복제 대상 서비스 후보 (전체 services light fields) */
  handoverServiceCandidates?: {
    id: string;
    serviceId: number;
    universityName: string;
    serviceName: string;
    /** 이미 인수인계 작성됨 (덮어쓰기 경고용) */
    hasRecord: boolean;
  }[];
  /** handover variant — 복제 실행 (from = 현재 service, to = 선택 서비스들) */
  onCopyHandover?: (
    fromServiceId: string,
    toServiceIds: string[],
  ) => Promise<{ ok: boolean; error?: string; copiedCount?: number }>;
};
