import type { ListRow } from "../patterns/ListPattern";
import type { Variant } from "../inspector/list-variants/types";
import { formatRelativeTime } from "@/lib/format-relative-time";

export type LiveTableDomain =
  | "incidents"
  | "todos"
  | "services"
  | "backup"
  | "schedule"
  | "handover"
  | "contracts"
  | "notice"
  | "receivables";
export type LiveBadgeDomain =
  | "사고"
  | "할일"
  | "서비스"
  | "백업"
  | "일정"
  | "인수인계"
  | "계약"
  | "공지"
  | "미수채권";

/** 트리아지 시급도 버킷 — 지금 당장 / 오늘 / 이번 주 / 추적중 */
export type TriageBucket = "now" | "today" | "week" | "track";

export type LiveTableItem = {
  id: string;
  domain: LiveTableDomain;
  badgeDomain: LiveBadgeDomain;
  variant: Variant;
  statusText: string;
  title: string;
  timeText: string;
  occurredAt: string;
  triage: TriageBucket;
  listRow: ListRow;
};

export type LiveTableSources = {
  incidents: { id: string; title: string; status: string; createdAt: string; listRow: ListRow }[];
  todos: { id: string; title: string; dueAt: string | null; createdAt: string; listRow: ListRow }[];
  services: { id: string; title: string; writeStartAt: string | null; createdAt: string; listRow: ListRow }[];
  backup: { id: string; title: string; status: string; createdAt: string; listRow: ListRow }[];
  schedule: { id: string; title: string; startAt: string; createdAt: string; listRow: ListRow }[];
  handover: { id: string; title: string; status: string; createdAt: string; listRow: ListRow }[];
  // 시트 기반(타임스탬프 없음)·신규 도메인은 optional — 기존 호출/테스트 fixture 호환.
  contracts?: { id: string; title: string; status: string; listRow: ListRow }[];
  notice?: { id: string; title: string; createdAt: string; listRow: ListRow }[];
  receivables?: { id: string; title: string; status: string; billedAt: string; listRow: ListRow }[];
};

const BADGE: Record<LiveTableDomain, LiveBadgeDomain> = {
  incidents: "사고",
  todos: "할일",
  services: "서비스",
  backup: "백업",
  schedule: "일정",
  handover: "인수인계",
  contracts: "계약",
  notice: "공지",
  receivables: "미수채권",
};

const VARIANT: Record<LiveTableDomain, Variant> = {
  incidents: "incidents",
  todos: "weekly-todo",
  services: "services",
  backup: "backup",
  schedule: "schedule",
  handover: "handover",
  contracts: "contracts",
  notice: "post-notice",
  receivables: "receivables",
};

/** receivables 입금여부 → 화면 라벨. ListRow.status('approved'|'active')와 동일 규칙. */
const RECEIVABLES_STATUS_LABEL: Record<string, string> = {
  approved: "수금완료",
  active: "미수",
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

function ymdFromIso(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(iso));
}

function startAtToMd(iso: string): string {
  return mdFromYmd(ymdFromIso(iso));
}

function dayDiff(ymd: string, today: string): number {
  return Math.round(
    (new Date(ymd + "T00:00:00+09:00").getTime() -
      new Date(today + "T00:00:00+09:00").getTime()) /
      86400000,
  );
}

/** 마감/이벤트 날짜 기준 트리아지: 지남→now, 오늘→today, 1~7일→week, 그 외/없음→track */
function bucketByDeadline(ymd: string | null | undefined, today: string): TriageBucket {
  if (!ymd) return "track";
  const d = ymd.slice(0, 10);
  if (d < today) return "now";
  if (d === today) return "today";
  return dayDiff(d, today) <= 7 ? "week" : "track";
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
      // 미처리 사고는 즉시 대응
      triage: i.status !== "처리완료" ? "now" : "track",
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
      triage: bucketByDeadline(t.dueAt, today),
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
      triage: bucketByDeadline(sv.writeStartAt, today),
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
      // 메일 발송 실패는 즉시 대응, 그 외 백업 요청은 추적
      triage: b.status === "mail_failed" ? "now" : "track",
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
      triage: bucketByDeadline(ymdFromIso(e.startAt), today),
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
      // 작성중 인수인계는 이번 주 마무리 권장, 그 외 추적
      triage: h.status === "draft" ? "week" : "track",
      listRow: h.listRow,
    });
  }

  for (const n of s.notice ?? []) {
    out.push({
      id: n.id,
      domain: "notice",
      badgeDomain: BADGE.notice,
      variant: VARIANT.notice,
      statusText: "공지",
      title: n.title,
      timeText: formatRelativeTime(n.createdAt, now),
      occurredAt: n.createdAt,
      // 공지는 정보성 — 추적 컬럼
      triage: "track",
      listRow: n.listRow,
    });
  }

  for (const r of s.receivables ?? []) {
    out.push({
      id: r.id,
      domain: "receivables",
      badgeDomain: BADGE.receivables,
      variant: VARIANT.receivables,
      statusText: RECEIVABLES_STATUS_LABEL[r.status] ?? r.status,
      title: r.title,
      // 청구일자(billedAt)는 ISO가 아닌 시트 텍스트일 수 있어 원문 그대로 표기.
      timeText: r.billedAt || "—",
      occurredAt: r.billedAt || "",
      // 미수채권은 장기 추적
      triage: "track",
      listRow: r.listRow,
    });
  }

  // 계약(contracts)은 시트 기반이라 행 단위 타임스탬프가 없음 →
  // occurredAt 빈 문자열로 최하단 정렬, 시점은 "—" 표기. 칩 필터로는 정상 노출.
  for (const c of s.contracts ?? []) {
    out.push({
      id: c.id,
      domain: "contracts",
      badgeDomain: BADGE.contracts,
      variant: VARIANT.contracts,
      statusText: c.status,
      title: c.title,
      timeText: "—",
      occurredAt: "",
      // 계약은 시점 없음 — 추적
      triage: "track",
      listRow: c.listRow,
    });
  }

  return out.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}
