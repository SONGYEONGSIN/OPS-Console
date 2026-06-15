"use client";

import type { LiveTableItem, TriageBucket } from "../live-table-builder";
import { SOLID_BADGE } from "../domain-tag";

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

const BADGE_BASE =
  "inline-block text-[9px] font-bold tracking-[0.06em] px-[5px] py-px leading-normal";

/**
 * 긴급도 분류 — 4버킷(지금 당장/오늘/이번 주/추적중) 2×2 그리드.
 * 각 컬럼 5행 고정 높이(262px) + 초과 스크롤. '지금 당장' vermilion 강조 + 좌측 띠.
 * 행 클릭 → onSelect.
 */
export function TriageColumns({ items, onSelect }: Props) {
  const grouped: Record<TriageBucket, LiveTableItem[]> = {
    now: [],
    today: [],
    week: [],
    track: [],
  };
  for (const it of items) grouped[it.triage].push(it);

  return (
    <div className="grid grid-cols-2 gap-4">
      {COLUMNS.map((col) => {
        const colItems = grouped[col.bucket];
        return (
          <div key={col.bucket} className="border border-line bg-situation-bg">
            <div
              className={`flex justify-between px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest ${
                col.accent
                  ? "bg-vermilion text-cream"
                  : "bg-ink text-cream"
              }`}
            >
              <span>{col.label}</span>
              <span
                className={`tabular-nums ${col.accent ? "" : "text-cream/70"}`}
              >
                {colItems.length}
              </span>
            </div>
            {colItems.length === 0 ? (
              <div className="flex h-[306px] items-center justify-center text-xs text-faint">
                —
              </div>
            ) : (
              <div className="h-[306px] divide-y divide-line-soft overflow-y-auto">
                {colItems.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => onSelect(it)}
                    className={`block w-full cursor-pointer px-3 py-2 text-left hover:bg-washi-raised ${
                      col.accent ? "border-l-[3px] !border-l-vermilion" : ""
                    }`}
                  >
                    <div className="mb-0.5 flex items-center gap-1.5">
                      <span
                        className={`${BADGE_BASE} ${SOLID_BADGE[it.badgeDomain]}`}
                      >
                        {it.badgeDomain}
                      </span>
                      <span className="text-[10px] font-bold text-ink-soft">
                        {it.statusText}
                      </span>
                    </div>
                    <div className="text-[12px] font-medium leading-snug">
                      {it.title}
                    </div>
                    {it.subtitle ? (
                      <div className="mt-0.5 line-clamp-1 text-[10px] leading-snug text-muted">
                        {it.subtitle}
                      </div>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
