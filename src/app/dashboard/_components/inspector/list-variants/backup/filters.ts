import type { ListRow } from "../../../patterns/ListPattern";

export const BACKUP_FILTERS = [
  { value: "all", label: "전체" },
  { value: "mine", label: "내가 등록" },
  { value: "mail_failed", label: "메일 실패" },
] as const;

export function blankBackupRow(opts?: { currentUserName?: string }): ListRow {
  return {
    id: "",
    name: "",
    status: "active",
    owner: opts?.currentUserName ?? "",
    substituteEmail: "",
    substituteName: "",
    backupServices: [],
    backupContacts: [],
    leaveStartDate: null,
    leaveEndDate: null,
    mailStatus: "pending",
    mailSentAt: null,
    mailError: null,
    summary: "",
  };
}
