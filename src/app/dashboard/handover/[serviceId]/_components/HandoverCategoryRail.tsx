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

  // 운영가이드 좌측 nav(OpsGuideNav)와 동일 구조 — 선택/호버 표준 인터랙션 색(#846).
  // 마커는 ◉/· 대신 작성 진행(○◐●), desc 줄은 카테고리 진행 카운트.
  return (
    <nav
      aria-label="인수인계 카테고리"
      className="flex flex-col gap-1 border-r border-line pr-4 max-md:flex-row max-md:overflow-x-auto max-md:border-b max-md:border-r-0 max-md:pb-3 max-md:pr-0"
    >
      {items.map(({ cat, filled, total, mark }) => {
        const on = cat.key === active;
        return (
          <button
            key={cat.key}
            type="button"
            onClick={() => onChange(cat.key)}
            className={`flex cursor-pointer items-start gap-2 border-l-2 px-3 py-2 text-left text-sm transition-colors max-md:border-b-2 max-md:border-l-0 max-md:px-4 ${
              on
                ? "border-vermilion bg-vermilion/10 font-medium text-vermilion"
                : "border-transparent text-ink hover:bg-line-soft"
            }`}
          >
            <span
              aria-hidden
              className={`mt-0.5 text-xs ${on ? "text-vermilion/70" : "text-muted"}`}
            >
              {mark}
            </span>
            <span className="flex-1">
              <span className="block">{cat.label}</span>
              <span className="block text-xs font-normal text-muted">
                {filled}/{total} 작성
              </span>
            </span>
          </button>
        );
      })}
      <p className="mt-auto border-t border-line-soft px-3 py-3 text-xs font-bold text-ink max-md:hidden">
        현재 {filledTotal}/{fieldTotal} 작성완료
      </p>
    </nav>
  );
}
