// 주간업무보고 권한 판정 — 순수 함수. admin 은 설정·당번 변경이 본업이고,
// 남의 보고서는 [정정]으로 다시 연 주에서만 고친다(spec §4.6).

import type { ReportStatus, WeekStatus } from "./constants";

export type Actor = { email: string; isAdmin: boolean };

export type WeekState = {
  status: WeekStatus;
  dutyEmail: string | null;
  reopenedAt: string | null;
};

const isOpen = (week: WeekState): boolean => week.status === "open";

export function isDuty(actor: Actor, week: WeekState): boolean {
  return week.dutyEmail !== null && actor.email === week.dutyEmail;
}

// 제출 현황과 남의 보고서를 여는 사람. 관리자·그 주 당번은 다루고("manage"),
// 받는 사람은 보고가 끝난 주만 읽는다("read"). 열람은 이 판정에 명단 소속·resolveTab 이 더해져 정해진다.
export type StatusAccess = "manage" | "read" | null;

export function statusAccess(
  actor: Actor,
  week: WeekState,
  isRecipient: boolean,
): StatusAccess {
  if (actor.isAdmin || isDuty(actor, week)) return "manage";
  if (isRecipient && week.status === "reported") return "read";
  return null;
}

export function canEditReport(
  actor: Actor,
  week: WeekState,
  ownerEmail: string,
): boolean {
  if (!isOpen(week)) return false;
  return (
    actor.email === ownerEmail ||
    isDuty(actor, week) ||
    (actor.isAdmin && week.reopenedAt !== null)
  );
}

export function canSubmitReport(
  actor: Actor,
  week: WeekState,
  ownerEmail: string,
  isWriter: boolean,
  reportStatus: ReportStatus,
): boolean {
  return (
    isOpen(week) &&
    actor.email === ownerEmail &&
    isWriter &&
    (reportStatus === "draft" || reportStatus === "returned")
  );
}

export function canReturnReport(
  actor: Actor,
  week: WeekState,
  reportStatus: ReportStatus,
): boolean {
  return (
    isOpen(week) &&
    (isDuty(actor, week) || actor.isAdmin) &&
    reportStatus === "submitted"
  );
}

export function canEditDutySummary(actor: Actor, week: WeekState): boolean {
  return isOpen(week) && (isDuty(actor, week) || actor.isAdmin);
}

export type FinalizeCheck =
  | { ok: true }
  | {
      ok: false;
      reason: "forbidden" | "locked" | "empty-roster" | "pending";
      pending: string[];
    };

export function checkFinalize(
  actor: Actor,
  week: WeekState,
  rosterEmails: readonly string[],
  submittedEmails: ReadonlySet<string>,
): FinalizeCheck {
  if (!isDuty(actor, week) && !actor.isAdmin) {
    return { ok: false, reason: "forbidden", pending: [] };
  }
  if (!isOpen(week)) return { ok: false, reason: "locked", pending: [] };
  if (rosterEmails.length === 0) {
    return { ok: false, reason: "empty-roster", pending: [] };
  }
  const pending = rosterEmails.filter((e) => !submittedEmails.has(e));
  return pending.length > 0
    ? { ok: false, reason: "pending", pending }
    : { ok: true };
}

export function canReopenWeek(actor: Actor, week: WeekState): boolean {
  return actor.isAdmin && week.status === "reported";
}

export function canManageSettings(actor: Actor): boolean {
  return actor.isAdmin;
}
