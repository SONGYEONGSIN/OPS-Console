"use client";

import {
  HANDOVER_CATEGORIES,
  type HandoverCategoryKey,
} from "@/features/handover/categories";
import type { ListRow } from "../../../patterns/ListPattern";
import { categoryProgress } from "./progress";

/** 카테고리 작성 진행 — 세로 3칸 배터리 게이지 (아래→위로 채움). */
function BatteryGauge({ filled, total }: { filled: number; total: number }) {
  const ratio = total === 0 ? 0 : filled / total;
  const lit =
    filled === 0 ? 0 : filled >= total ? 3 : Math.max(1, Math.round(ratio * 3));
  const litColor = filled >= total ? "bg-sage" : "bg-gold";
  const srText =
    filled === 0
      ? "미작성"
      : filled >= total
        ? "작성 완료"
        : `작성 ${filled}/${total}`;
  return (
    <span className="ml-1 inline-flex flex-col items-center" title={srText}>
      {/* 배터리 단자(위) */}
      <span aria-hidden className="h-px w-1 rounded-t-[1px] bg-line-soft" />
      <span
        aria-hidden
        className="flex h-3 w-[7px] flex-col gap-px rounded-[1px] border border-line-soft p-px"
      >
        {/* 위→아래 렌더, 아래 칸부터 채움 */}
        {[2, 1, 0].map((i) => (
          <span
            key={i}
            className={`flex-1 rounded-[0.5px] ${i < lit ? litColor : "bg-transparent"}`}
          />
        ))}
      </span>
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
            <BatteryGauge filled={prog.filled} total={prog.total} />
          </button>
        );
      })}
    </div>
  );
}
