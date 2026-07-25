import type { MailboxEntry } from "./queries";

/** 메일함 트리아지 범위 — 전체 / 미회신 / 오늘 / 안읽음. */
export type MailboxScope = "all" | "unreplied" | "today" | "unread";

export type MailboxScopeCounts = Record<MailboxScope, number>;

const DAY_MS = 86_400_000;
const REPLIED_STATUSES = new Set(["sent", "dry_run"]);

/** 회신 완료 여부 — 최신 draft가 발송(sent/dry_run)됨. */
export function isReplied(entry: MailboxEntry): boolean {
  const s = entry.latestDraft?.status;
  return s ? REPLIED_STATUSES.has(s) : false;
}

/** 안읽음 여부. */
export function isUnread(entry: MailboxEntry): boolean {
  return entry.message.is_read === false;
}

/** 수신 후 경과 일수(floor). received_at 없음/미래면 0. */
export function waitingDays(entry: MailboxEntry, nowMs: number): number {
  const r = entry.message.received_at;
  if (!r) return 0;
  const diff = nowMs - new Date(r).getTime();
  return diff <= 0 ? 0 : Math.floor(diff / DAY_MS);
}

const kstDate = (ms: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date(ms),
  );

/** KST 기준 오늘 수신 여부. */
export function isReceivedToday(entry: MailboxEntry, nowMs: number): boolean {
  const r = entry.message.received_at;
  if (!r) return false;
  return kstDate(new Date(r).getTime()) === kstDate(nowMs);
}

/** 보낸이·주소·제목·미리보기 부분일치(대소문자 무시). 빈 검색어면 전부 통과. */
export function matchesSearch(entry: MailboxEntry, q: string): boolean {
  const term = q.trim().toLowerCase();
  if (!term) return true;
  const m = entry.message;
  return [m.from_name, m.from_email, m.subject, m.body_preview].some((v) =>
    (v ?? "").toLowerCase().includes(term),
  );
}

/** scope 필터. */
export function filterScope(
  entries: MailboxEntry[],
  scope: MailboxScope,
  nowMs: number,
): MailboxEntry[] {
  switch (scope) {
    case "unreplied":
      return entries.filter((e) => !isReplied(e));
    case "today":
      return entries.filter((e) => isReceivedToday(e, nowMs));
    case "unread":
      return entries.filter((e) => isUnread(e));
    default:
      return entries;
  }
}

/** scope별 카운트(칩 표시용) — 페이지 한정 아님. */
export function countScopes(
  entries: MailboxEntry[],
  nowMs: number,
): MailboxScopeCounts {
  return {
    all: entries.length,
    unreplied: entries.filter((e) => !isReplied(e)).length,
    today: entries.filter((e) => isReceivedToday(e, nowMs)).length,
    unread: entries.filter((e) => isUnread(e)).length,
  };
}
