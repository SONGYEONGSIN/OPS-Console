"use client";

import type { FeedDomain } from "./feed";

export type FeedFilter = FeedDomain | "all";

type Counts = Record<"all" | FeedDomain, number>;

const ORDER: { key: FeedFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "incidents", label: "사고" },
  { key: "todos", label: "내 할일" },
  { key: "services", label: "서비스" },
  { key: "schedule", label: "일정" },
  { key: "backup", label: "백업" },
];

type Props = {
  active: FeedFilter;
  counts: Counts;
  onChange: (next: FeedFilter) => void;
};

export function FeedChips({ active, counts, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {ORDER.map((c) => {
        const isActive = active === c.key;
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(c.key)}
            className={
              isActive
                ? "border border-vermilion bg-vermilion px-2.5 py-1 text-xs text-cream"
                : "border border-line bg-cream px-2.5 py-1 text-xs text-ink hover:bg-washi-raised"
            }
          >
            {c.label} {counts[c.key]}
          </button>
        );
      })}
    </div>
  );
}
