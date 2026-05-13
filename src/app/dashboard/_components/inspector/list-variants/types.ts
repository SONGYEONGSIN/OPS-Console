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
  | "backup";

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
};
