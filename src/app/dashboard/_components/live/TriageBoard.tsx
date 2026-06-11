"use client";

import { DomainBadge } from "./DomainBadge";
import type { LiveTableItem, TriageBucket } from "./live-table-builder";

type Props = {
  items: LiveTableItem[];
  onSelect: (item: LiveTableItem) => void;
};

const COLUMNS: { bucket: TriageBucket; label: string; accent: boolean }[] = [
  { bucket: "now", label: "지금 당장", accent: true },
  { bucket: "today", label: "오늘", accent: false },
  { bucket: "week", label: "이번 주", accent: false },
  { bucket: "track", label: "추적중", accent: false },
];

/** 트리아지 보드 — 시급도 4열(지금 당장/오늘/이번 주/추적중)을 굵은 세로 괘선으로 구획.
    같은 피드 데이터를 시급도 관점으로 한눈에 분류. 행 클릭 → onSelect. */
export function TriageBoard({ items, onSelect }: Props) {
  const grouped: Record<TriageBucket, LiveTableItem[]> = {
    now: [],
    today: [],
    week: [],
    track: [],
  };
  for (const it of items) grouped[it.triage].push(it);

  return (
    <div className="grid grid-cols-1 border border-ink md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col, ci) => {
        const colItems = grouped[col.bucket];
        return (
          <section
            key={col.bucket}
            aria-label={`${col.label} ${colItems.length}건`}
            className={`flex min-w-0 flex-col ${ci > 0 ? "border-line xl:border-l" : ""}`}
          >
            <header
              className={`flex items-baseline justify-between border-b border-ink px-3 py-2 ${
                col.accent ? "bg-vermilion text-cream" : "bg-washi text-ink"
              }`}
            >
              <span className="text-xs font-bold tracking-[0.02em]">
                {col.label}
              </span>
              <span className="text-xs font-semibold tabular-nums">
                {colItems.length}
              </span>
            </header>
            <div className="flex flex-col">
              {colItems.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-faint">—</p>
              ) : (
                colItems.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => onSelect(it)}
                    className={`flex cursor-pointer flex-col gap-1 border-b border-line-soft px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-washi-raised ${
                      col.accent ? "border-l-2 border-l-vermilion" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <DomainBadge domain={it.badgeDomain} />
                      <span className="text-xs font-semibold text-ink-soft tabular-nums">
                        {it.statusText}
                      </span>
                    </span>
                    <span className="truncate text-sm font-medium text-ink">
                      {it.title}
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
