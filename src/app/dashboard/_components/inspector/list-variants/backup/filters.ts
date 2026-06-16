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

/** "2026-06-16" → "06.16" (월.일). 없으면 빈 문자열. */
function mdLabel(d: string | null | undefined): string {
  return d ? d.slice(5, 10).replace("-", ".") : "";
}

/**
 * 백업 요청 제목 자동 생성 — "{운영자이름} 백업요청(MM.DD~MM.DD)".
 * 예: 홍길동 백업요청(06.16~06.17). 이름이 없으면 빈 문자열.
 */
export function buildBackupTitle(
  name: string,
  start: string | null,
  end: string | null,
): string {
  if (!name) return "";
  return `${name} 백업요청(${mdLabel(start)}~${mdLabel(end)})`;
}

/** 제목이 비었거나 자동생성 패턴이면 true — 수동 편집한 제목은 덮어쓰지 않기 위함. */
export function isAutoBackupTitle(title: string): boolean {
  return title.trim() === "" || /백업요청\(.*\)\s*$/.test(title);
}
