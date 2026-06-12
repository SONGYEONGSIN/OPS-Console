import type { LiveBadgeDomain, TriageBucket } from "./live-table-builder";

/** OPS-6 시안 .badge — 도메인별 솔리드 배지(채운 배경 + cream).
    DomainBadge(아웃라인)와 색 의미는 동일하되 밀집 영역(트리아지·피드)에선 솔리드로 강조. */
export const SOLID_BADGE: Record<LiveBadgeDomain, string> = {
  사고: "bg-vermilion text-cream",
  할일: "bg-ink text-cream",
  서비스: "bg-muted text-cream",
  백업: "bg-indigo text-cream",
  일정: "bg-amber text-cream",
  인수인계: "bg-gold text-cream",
  계약: "bg-sage text-cream",
  공지: "bg-vermilion-deep text-cream",
  미수채권: "bg-green-light text-cream",
};

/** 피드 테이블 상태 dot 색 — 트리아지 시급도 기준 */
export const STATUS_DOT: Record<TriageBucket, string> = {
  now: "bg-vermilion",
  today: "bg-amber",
  week: "bg-indigo",
  track: "bg-faint",
};

/** 피드 테이블 '트리아지' 참조 칩 — 시급도 라벨 + 색 */
export const TRIAGE_REF: Record<TriageBucket, { label: string; cls: string }> = {
  now: { label: "지금", cls: "bg-vermilion text-cream" },
  today: { label: "오늘", cls: "bg-ink/10 text-ink" },
  week: { label: "이번주", cls: "bg-ink/[0.07] text-muted" },
  track: { label: "추적", cls: "border border-line-soft text-faint" },
};
