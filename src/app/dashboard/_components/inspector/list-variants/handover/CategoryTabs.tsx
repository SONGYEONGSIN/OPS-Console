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
    <div className="flex w-full flex-wrap gap-1 border-b border-line">
      {HANDOVER_CATEGORIES.map((c) => {
        const on = c.key === active;
        return (
          <button
            key={c.key}
            type="button"
            aria-current={on ? "true" : undefined}
            onClick={() => onChange(c.key)}
            className={`-mb-px cursor-pointer border-b-2 px-2.5 py-1.5 text-xs font-medium transition-colors ${
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
