import type { ListRow } from "../../../patterns/ListPattern";

export const BACKUP_FILTERS = [
  { value: "all", label: "전체" },
  { value: "mine", label: "내가 요청" },
  { value: "mine_substitute", label: "내가 백업" },
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
    // PR-2: services는 uuid[] (EditForm input), services_detail은 join 결과 (view 전용)
    backupServices: [],
    backupServicesDetail: [],
    leaveStartDate: null,
    leaveEndDate: null,
    mailStatus: "pending",
    mailSentAt: null,
    mailError: null,
    summary: "",
  };
}
