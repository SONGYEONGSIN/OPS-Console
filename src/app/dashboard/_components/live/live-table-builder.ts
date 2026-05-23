import type { ListRow } from "../patterns/ListPattern";
import type { Variant } from "../inspector/list-variants/types";
import { formatRelativeTime } from "@/lib/format-relative-time";

export type LiveTableDomain = "incidents" | "todos" | "services" | "backup" | "schedule" | "handover";
export type LiveBadgeDomain = "사고" | "할일" | "서비스" | "백업" | "일정" | "인수인계";

export type LiveTableItem = {
  id: string;
  domain: LiveTableDomain;
  badgeDomain: LiveBadgeDomain;
  variant: Variant;
  statusText: string;
  title: string;
  timeText: string;
  occurredAt: string;
  listRow: ListRow;
};

export type LiveTableSources = {
  incidents: { id: string; title: string; status: string; createdAt: string; listRow: ListRow }[];
  todos: { id: string; title: string; dueAt: string | null; createdAt: string; listRow: ListRow }[];
  services: { id: string; title: string; writeStartAt: string | null; createdAt: string; listRow: ListRow }[];
  backup: { id: string; title: string; status: string; createdAt: string; listRow: ListRow }[];
  schedule: { id: string; title: string; startAt: string; createdAt: string; listRow: ListRow }[];
  handover: { id: string; title: string; status: string; createdAt: string; listRow: ListRow }[];
};

const BADGE: Record<LiveTableDomain, LiveBadgeDomain> = {
  incidents: "사고",
  todos: "할일",
  services: "서비스",
  backup: "백업",
  schedule: "일정",
  handover: "인수인계",
};

const VARIANT: Record<LiveTableDomain, Variant> = {
  incidents: "incidents",
  todos: "weekly-todo",
  services: "services",
  backup: "backup",
  schedule: "schedule",
  handover: "handover",
};

/** handover_records.status DB enum → 화면 한글 라벨. HandoverControls와 동일 라벨. */
const HANDOVER_STATUS_LABEL: Record<string, string> = {
  draft: "작성중",
  ready: "작성완료",
  published: "인계완료",
};

function todayKst(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}

function mdFromYmd(ymd: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(ymd.slice(0, 10));
  if (!m) return ymd;
  return `${Number(m[1])}.${Number(m[2])}`;
}

function todoStatus(dueAt: string | null, today: string): string {
  if (!dueAt) return "대기";
  const d = dueAt.slice(0, 10);
  if (d < today) return "지남";
  if (d === today) return "오늘";
  const diffDays = Math.round(
    (new Date(d + "T00:00:00+09:00").getTime() - new Date(today + "T00:00:00+09:00").getTime()) /
      86400000,
  );
  return `D-${diffDays}`;
}

function startAtToMd(iso: string): string {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(iso));
  return mdFromYmd(ymd);
}

/** 5도메인 소스를 LiveTableItem[]으로 통합하고 occurredAt 내림차순 정렬한다. */
export function buildLiveTableItems(s: LiveTableSources, now: Date = new Date()): LiveTableItem[] {
  const today = todayKst(now);
  const out: LiveTableItem[] = [];

  for (const i of s.incidents) {
    out.push({
      id: i.id,
      domain: "incidents",
      badgeDomain: BADGE.incidents,
      variant: VARIANT.incidents,
      statusText: i.status,
      title: i.title,
      timeText: formatRelativeTime(i.createdAt, now),
      occurredAt: i.createdAt,
      listRow: i.listRow,
    });
  }

  for (const t of s.todos) {
    out.push({
      id: t.id,
      domain: "todos",
      badgeDomain: BADGE.todos,
      variant: VARIANT.todos,
      statusText: todoStatus(t.dueAt, today),
      title: t.title,
      timeText: formatRelativeTime(t.createdAt, now),
      occurredAt: t.createdAt,
      listRow: t.listRow,
    });
  }

  for (const sv of s.services) {
    out.push({
      id: sv.id,
      domain: "services",
      badgeDomain: BADGE.services,
      variant: VARIANT.services,
      statusText: sv.writeStartAt ? `${mdFromYmd(sv.writeStartAt)} 오픈` : "—",
      title: sv.title,
      timeText: formatRelativeTime(sv.createdAt, now),
      occurredAt: sv.createdAt,
      listRow: sv.listRow,
    });
  }

  for (const b of s.backup) {
    out.push({
      id: b.id,
      domain: "backup",
      badgeDomain: BADGE.backup,
      variant: VARIANT.backup,
      statusText: b.status,
      title: b.title,
      timeText: formatRelativeTime(b.createdAt, now),
      occurredAt: b.createdAt,
      listRow: b.listRow,
    });
  }

  for (const e of s.schedule) {
    out.push({
      id: e.id,
      domain: "schedule",
      badgeDomain: BADGE.schedule,
      variant: VARIANT.schedule,
      statusText: startAtToMd(e.startAt),
      title: e.title,
      timeText: formatRelativeTime(e.createdAt, now),
      occurredAt: e.createdAt,
      listRow: e.listRow,
    });
  }

  for (const h of s.handover) {
    out.push({
      id: h.id,
      domain: "handover",
      badgeDomain: BADGE.handover,
      variant: VARIANT.handover,
      statusText: HANDOVER_STATUS_LABEL[h.status] ?? h.status,
      title: h.title,
      timeText: formatRelativeTime(h.createdAt, now),
      occurredAt: h.createdAt,
      listRow: h.listRow,
    });
  }

  return out.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}
