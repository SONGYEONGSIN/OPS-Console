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
  | "cohort"
  | "receivables"
  | "ai-work"
  | "backup"
  | "services"
  | "contracts";

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
  /** services variant — 운영자·개발자 후보 (operators 마스터, active) */
  servicesOperators?: { email: string; name: string }[];
  /** services variant — 대학명 → 학교키·다음 시퀀스 매핑 (자동 service_id 부여용) */
  servicesUniversityKeys?: {
    universityName: string;
    key: number;
    nextSeq: number;
  }[];
};
