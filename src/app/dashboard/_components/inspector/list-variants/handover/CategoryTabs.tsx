"use client";

import {
  HANDOVER_CATEGORIES,
  type HandoverCategoryKey,
} from "@/features/handover/categories";
import type { ListRow } from "../../../patterns/ListPattern";
import { categoryProgress } from "./progress";

/** 카테고리 작성 진행 도트 — ● 모두 / ◑ 일부 / ○ 미작성 */
function ProgressDot({ filled, total }: { filled: number; total: number }) {
  const glyph = filled === 0 ? "○" : filled >= total ? "●" : "◑";
  const color =
    filled === 0
      ? "text-faint"
      : filled >= total
        ? "text-sage"
        : "text-gold";
  return (
    <span aria-hidden className={`ml-0.5 text-[0.5rem] ${color}`}>
      {glyph}
    </span>
  );
}

/** 인수인계 카테고리 탭 — View·EditForm 공용. (기존 select 대체) */
export function CategoryTabs({
  active,
  onChange,
  row,
}: {
  active: HandoverCategoryKey;
  onChange: (key: HandoverCategoryKey) => void;
  row: ListRow;
}) {
  return (
    <div className="flex w-full justify-between border-b border-line">
      {HANDOVER_CATEGORIES.map((c) => {
        const on = c.key === active;
        const prog = categoryProgress(row, c.key);
        return (
          <button
            key={c.key}
            type="button"
            aria-current={on ? "true" : undefined}
            onClick={() => onChange(c.key)}
            className={`-mb-px inline-flex shrink-0 cursor-pointer items-center whitespace-nowrap border-b-2 px-1.5 py-1.5 text-xs font-medium transition-colors ${
              on
                ? "border-vermilion text-ink"
                : "border-transparent text-muted hover:text-ink-soft"
            }`}
          >
            {c.label}
            <ProgressDot filled={prog.filled} total={prog.total} />
          </button>
        );
      })}
    </div>
  );
}
