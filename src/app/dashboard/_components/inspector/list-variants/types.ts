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
  | "ai-work";

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
  onInvite?: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onUpdateRemarks?: (
    row: ListRow,
    newText: string,
  ) => Promise<{ ok: boolean; error?: string }>;
};
