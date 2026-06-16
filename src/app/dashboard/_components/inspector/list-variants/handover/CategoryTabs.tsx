"use client";

import {
  HANDOVER_CATEGORIES,
  type HandoverCategoryKey,
} from "@/features/handover/categories";

/** 인수인계 카테고리 탭 — View·EditForm 공용. (기존 select 대체) */
export function CategoryTabs({
  active,
  onChange,
}: {
  active: HandoverCategoryKey;
  onChange: (key: HandoverCategoryKey) => void;
}) {
  return (
    <div className="flex w-full justify-between border-b border-line">
      {HANDOVER_CATEGORIES.map((c) => {
        const on = c.key === active;
        return (
          <button
            key={c.key}
            type="button"
            aria-label={c.label}
            aria-current={on ? "true" : undefined}
            onClick={() => onChange(c.key)}
            className={`-mb-px inline-flex shrink-0 cursor-pointer items-center whitespace-nowrap border-b-2 px-1 py-1.5 text-xs font-medium transition-colors ${
              on
                ? "border-vermilion text-ink"
                : "border-transparent text-muted hover:text-ink-soft"
            }`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
