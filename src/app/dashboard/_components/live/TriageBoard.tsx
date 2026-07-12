"use client";

import type { LiveTableItem, TriageBucket } from "./live-table-builder";
import { SOLID_BADGE } from "./domain-tag";

type Props = {
  items: LiveTableItem[];
  onSelect: (item: LiveTableItem) => void;
};

const COLUMNS: { bucket: TriageBucket; label: string; en: string; accent: boolean }[] = [
  { bucket: "now", label: "지금 당장", en: "NOW", accent: true },
  { bucket: "today", label: "오늘", en: "TODAY", accent: false },
  { bucket: "week", label: "이번 주", en: "THIS WEEK", accent: false },
  { bucket: "track", label: "추적중", en: "TRACKING", accent: false },
];

/** 트리아지 보드 (OPS-6) — 시급도 4열을 괘선으로 구획, 한눈에 분류.
    오늘·이번 주 컬럼을 넓게(1.5fr). '지금 당장' vermilion 강조. 행 클릭 → onSelect. */
export function TriageBoard({ items, onSelect }: Props) {
  const grouped: Record<TriageBucket, LiveTableItem[]> = {
    now: [],
    today: [],
    week: [],
    track: [],
  };
  for (const it of items) grouped[it.triage].push(it);

  return (
    <div className="grid grid-cols-1 border-y-2 border-ink md:grid-cols-2 xl:grid-cols-[1fr_1.5fr_1.5fr_1fr]">
      {COLUMNS.map((col, ci) => {
        const colItems = grouped[col.bucket];
        return (
          <section
            key={col.bucket}
            aria-label={`${col.label} ${colItems.length}건`}
            className={`flex min-w-0 flex-col bg-cream ${ci > 0 ? "border-line xl:border-l" : ""}`}
          >
            <header
              className={`flex shrink-0 items-baseline gap-2 border-b border-line px-3 py-1.5 ${
                col.accent ? "bg-vermilion" : "bg-washi-raised"
              }`}
            >
              <span
                className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
                  col.accent ? "text-cream" : "text-ink"
                }`}
              >
                {col.label}
              </span>
              <span
                className={`text-[8px] uppercase tracking-[0.18em] ${
                  col.accent ? "text-cream/80" : "text-muted"
                }`}
              >
                {col.en}
              </span>
              <span
                className={`ml-auto text-[11px] font-bold tabular-nums ${
                  col.accent ? "text-cream/85" : "text-muted"
                }`}
              >
                {colItems.length}
              </span>
            </header>
            <div className="max-h-[200px] min-h-[72px] overflow-y-auto">
              {colItems.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-faint">—</p>
              ) : (
                colItems.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => onSelect(it)}
                    className={`flex w-full cursor-pointer flex-col gap-0.5 border-b border-line-soft px-3 py-1.5 text-left transition-colors last:border-b-0 hover:bg-line-soft ${
                      col.accent ? "border-l-[3px] border-l-vermilion" : ""
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex shrink-0 items-center px-1 py-px text-[9px] font-bold leading-none ${SOLID_BADGE[it.badgeDomain]}`}
                      >
                        {it.badgeDomain}
                      </span>
                      <span className="text-[10px] font-semibold text-ink-soft tabular-nums">
                        {it.statusText}
                      </span>
                    </span>
                    <span className="truncate text-[11px] font-medium leading-tight text-ink">
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
