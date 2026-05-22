import type { ListRow } from "../patterns/ListPattern";
import type { Variant } from "../inspector/list-variants/types";

export type FeedDomain = "incidents" | "todos" | "services" | "schedule" | "backup";
export type FeedTier = "urgent" | "scheduled" | "undated";

export type FeedItem = {
  id: string;
  domain: FeedDomain;
  domainLabel: string;
  variant: Variant;
  date: string | null;
  dateDisplay: string;
  title: string;
  tier: FeedTier;
  listRow: ListRow;
};

export type FeedSources = {
  incidents: { id: string; title: string; occurred_date: string | null; status: string; listRow: ListRow }[];
  todos: { id: string; title: string; due_at: string | null; listRow: ListRow }[];
  services: { id: string; title: string; write_start_at: string | null; listRow: ListRow }[];
  schedule: { id: string; title: string; start_at: string; listRow: ListRow }[];
  backup: { id: string; title: string; leave_start_date: string | null; listRow: ListRow }[];
};

const DOMAIN_LABEL: Record<FeedDomain, string> = {
  incidents: "사고",
  todos: "내 할일",
  services: "서비스",
  schedule: "일정",
  backup: "백업",
};

const DOMAIN_VARIANT: Record<FeedDomain, Variant> = {
  incidents: "incidents",
  todos: "weekly-todo",
  services: "services",
  schedule: "schedule",
  backup: "backup",
};

function ymdKst(input: string | null): string | null {
  if (!input) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(input));
}

function todayKst(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}

export function buildFeedItems(sources: FeedSources, now: Date = new Date()): FeedItem[] {
  const today = todayKst(now);
  const out: FeedItem[] = [];
  for (const i of sources.incidents) {
    const date = ymdKst(i.occurred_date);
    const urgent = i.status !== "처리완료";
    const tier: FeedTier = urgent ? "urgent" : date ? "scheduled" : "undated";
    out.push(make("incidents", i.id, i.title, date, tier, i.listRow, now));
  }
  for (const t of sources.todos) {
    const date = ymdKst(t.due_at);
    let tier: FeedTier;
    if (!date) tier = "undated";
    else if (date < today) tier = "urgent";
    else tier = "scheduled";
    out.push(make("todos", t.id, t.title, date, tier, t.listRow, now));
  }
  for (const s of sources.services) {
    const date = ymdKst(s.write_start_at);
    const tier: FeedTier = date ? "scheduled" : "undated";
    out.push(make("services", s.id, s.title, date, tier, s.listRow, now));
  }
  for (const e of sources.schedule) {
    const date = ymdKst(e.start_at);
    out.push(make("schedule", e.id, e.title, date, "scheduled", e.listRow, now));
  }
  for (const b of sources.backup) {
    const date = ymdKst(b.leave_start_date);
    const tier: FeedTier = date ? "scheduled" : "undated";
    out.push(make("backup", b.id, b.title, date, tier, b.listRow, now));
  }
  return out;
}

function make(
  domain: FeedDomain,
  id: string,
  title: string,
  date: string | null,
  tier: FeedTier,
  listRow: ListRow,
  now: Date,
): FeedItem {
  return {
    id,
    domain,
    domainLabel: DOMAIN_LABEL[domain],
    variant: DOMAIN_VARIANT[domain],
    date,
    dateDisplay: formatFeedDate({ tier, domain, date }, now),
    title,
    tier,
    listRow,
  };
}

const TIER_ORDER: Record<FeedTier, number> = { urgent: 0, scheduled: 1, undated: 2 };

export function sortFeedItems(items: FeedItem[]): FeedItem[] {
  return [...items].sort((a, b) => {
    const t = TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
    if (t !== 0) return t;
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return 0;
  });
}

export function formatFeedDate(
  item: { tier: FeedTier; domain: FeedDomain; date: string | null },
  now: Date,
): string {
  if (item.tier === "urgent") {
    return item.domain === "incidents" ? "미해결" : "지남";
  }
  if (item.tier === "undated" || !item.date) return "—";
  const today = todayKst(now);
  if (item.date === today) return "오늘";
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(item.date);
  if (!m) return "—";
  return `${Number(m[1])}.${Number(m[2])}`;
}
