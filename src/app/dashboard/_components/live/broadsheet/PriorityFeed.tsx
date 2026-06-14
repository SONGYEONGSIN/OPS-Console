"use client";

import { useMemo, useState } from "react";
import type { LiveTableItem, LiveBadgeDomain } from "../live-table-builder";
import { SOLID_BADGE } from "../domain-tag";

type Props = {
  items: LiveTableItem[];
  onSelect: (item: LiveTableItem) => void;
};

const PAGE = 10;

/** 칩 노출 순서 (있는 도메인만 표시). */
const DOMAIN_ORDER: LiveBadgeDomain[] = [
  "사고",
  "일정",
  "계약",
  "인수인계",
  "서비스",
  "백업",
  "미수채권",
  "할일",
  "공지",
];

const BADGE_BASE =
  "inline-block text-[9px] font-bold tracking-[0.06em] px-[5px] py-px leading-normal";

type Filter = LiveBadgeDomain | "all";

/**
 * 우선순위 피드 — 카테고리 칩(다줄) 필터 + 10개/페이지 넘기기.
 * 카드 클릭 → onSelect.
 */
export function PriorityFeed({ items, onSelect }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);

  const counts = useMemo(() => {
    const m = new Map<LiveBadgeDomain, number>();
    for (const it of items) m.set(it.badgeDomain, (m.get(it.badgeDomain) ?? 0) + 1);
    return m;
  }, [items]);

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.badgeDomain === filter)),
    [filter, items],
  );

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, pages - 1);
  const visible = filtered.slice(safePage * PAGE, safePage * PAGE + PAGE);

  function pick(next: Filter) {
    setFilter(next);
    setPage(0);
  }

  const chipBase = "px-2 py-1 cursor-pointer";

  return (
    <div className="flex flex-col lg:absolute lg:inset-0">
      <h3 className="mb-1 text-2xl font-black leading-tight tracking-tight">
        우선순위 피드
      </h3>
      <div className="mb-4 flex items-center justify-between border-y border-line py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
        <span>Live Feed</span>
        <span className="bg-ink px-1.5 py-0.5 text-[9px] tabular-nums text-cream">
          {items.length}건
        </span>
      </div>

      {/* 카테고리 칩 — 다줄 wrap */}
      <div className="mb-3 flex flex-wrap gap-1 text-[10px] font-bold uppercase">
        <button
          type="button"
          onClick={() => pick("all")}
          className={`${chipBase} ${
            filter === "all"
              ? "bg-ink text-cream"
              : "border border-line-soft text-muted"
          }`}
        >
          전체 {items.length}
        </button>
        {DOMAIN_ORDER.filter((d) => counts.has(d)).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => pick(d)}
            className={`${chipBase} ${
              filter === d
                ? "bg-ink text-cream"
                : "border border-line-soft text-muted"
            }`}
          >
            {d} {counts.get(d)}
          </button>
        ))}
      </div>

      {/* 카드 목록 — 컬럼 남은 높이를 flex-1로 채우고 내부 스크롤 (페이저와의 빈 공간 방지) */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto">
        {visible.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={() => onSelect(it)}
            className="cursor-pointer border border-line-soft bg-white p-3 text-left transition-colors hover:bg-cream"
          >
            <div className="mb-1 flex items-center justify-between">
              <span className={`${BADGE_BASE} ${SOLID_BADGE[it.badgeDomain]}`}>
                {it.badgeDomain}
              </span>
              <span className="text-[10px] tabular-nums text-faint">
                {it.timeText}
              </span>
            </div>
            <div className="text-sm font-bold leading-snug">{it.title}</div>
            {it.subtitle ? (
              <div className="mt-0.5 line-clamp-1 text-[10px] leading-snug text-muted">
                {it.subtitle}
              </div>
            ) : null}
          </button>
        ))}
        {visible.length === 0 && (
          <p className="px-1 py-6 text-center text-xs text-faint">
            표시할 항목이 없습니다.
          </p>
        )}
      </div>

      {/* 페이저 — 2페이지 이상일 때만. mt-auto로 컬럼 하단 라인에 정렬. */}
      {pages > 1 && (
        <div className="mt-auto flex items-center justify-between pt-3 text-[11px] font-bold text-muted">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="border border-line-soft px-3 py-1 hover:border-ink hover:bg-ink hover:text-cream disabled:opacity-30"
          >
            ◀ 이전
          </button>
          <span className="tabular-nums">
            {safePage + 1} / {pages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={safePage >= pages - 1}
            className="border border-line-soft px-3 py-1 hover:border-ink hover:bg-ink hover:text-cream disabled:opacity-30"
          >
            다음 ▶
          </button>
        </div>
      )}
    </div>
  );
}
