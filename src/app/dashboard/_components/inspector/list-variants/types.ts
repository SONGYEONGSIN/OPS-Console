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
  | "handover"
  | "assignments"
  | "worklog"
  | "data-request"
  | "performance"
  | "manual";

export type ViewProps = {
  row: ListRow;
  currentUserPermission?: OperatorPermission | null;
  receivablesMailDryRun?: boolean;
};

export type EditFormProps = {
  row: ListRow;
  setRow: Dispatch<SetStateAction<ListRow>>;
  onSave: (next: ListRow) => void;
  onCancel: () => void;
  /** team variant — 권한 select admin only 분기 */
  currentUserPermission?: OperatorPermission | null;
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
  /** backup variant — 대학 연락처 후보 (contacts 마스터 light fields) */
  backupContactCandidates?: {
    id: string;
    customer_name: string;
    university_name: string;
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
