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
                className={`flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
                  on
                    ? "bg-ink font-medium text-cream"
                    : "text-ink-soft hover:bg-washi"
                }`}
              >
                <span>
                  {/* 검정 배경에서는 text-muted가 묻히므로 크림 계열로 */}
                  <span
                    aria-hidden
                    className={`mr-2 ${on ? "text-cream/70" : "text-muted"}`}
                  >
                    {mark}
                  </span>
                  {cat.label}
                </span>
                <span
                  className={`text-2xs ${on ? "text-cream/70" : "text-muted"}`}
                >
                  {filled}/{total}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-auto border-t border-line-soft px-4 py-3 text-xs font-bold text-ink">
        현재 {filledTotal}/{fieldTotal} 작성완료
      </p>
    </nav>
  );
}
