"use client";

import type { ListRow } from "@/app/dashboard/_components/patterns/ListPattern";
import {
  HANDOVER_CATEGORIES,
  type HandoverCategoryKey,
} from "@/features/handover/categories";
import { categoryProgress } from "@/app/dashboard/_components/inspector/list-variants/handover/progress";

export function HandoverCategoryRail({
  row,
  active,
  onChange,
}: {
  row: ListRow;
  active: HandoverCategoryKey;
  onChange: (key: HandoverCategoryKey) => void;
}) {
  const items = HANDOVER_CATEGORIES.map((cat) => {
    const { filled, total } = categoryProgress(row, cat.key);
    const mark = filled === 0 ? "○" : filled === total ? "●" : "◐";
    return { cat, filled, total, mark };
  });
  const filledTotal = items.reduce((sum, it) => sum + it.filled, 0);
  const fieldTotal = items.reduce((sum, it) => sum + it.total, 0);

  return (
    <nav className="flex w-44 shrink-0 flex-col border-r border-line">
      <ul>
        {items.map(({ cat, filled, total, mark }) => {
          const on = cat.key === active;
          return (
            <li key={cat.key}>
              <button
                type="button"
                onClick={() => onChange(cat.key)}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
                  on
                    ? "bg-washi-raised font-medium text-ink"
                    : "text-ink-soft hover:bg-washi"
                }`}
              >
                <span>
                  <span aria-hidden className="mr-2 text-muted">
                    {mark}
                  </span>
                  {cat.label}
                </span>
                <span className="text-2xs text-muted">
                  {filled}/{total}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-auto border-t border-line-soft px-4 py-3 text-xs font-bold text-ink">
        진행 {filledTotal}/{fieldTotal}
      </p>
    </nav>
  );
}
