"use client";

import { removeManualItem } from "@/features/ops-weekly/actions";
import type { ManualItem } from "@/features/ops-weekly/merge";
import { formatMdDow } from "../_format";
import { BADGE_CLASS, BTN_CLASS, ERROR_CLASS } from "./styles";
import { useSave } from "./use-save";

function periodOf(m: ManualItem): string | null {
  if (!m.period_start) return null;
  const a = formatMdDow(m.period_start);
  return m.period_end && m.period_end !== m.period_start
    ? `${a} ~ ${formatMdDow(m.period_end)}`
    : a;
}

/** 직접 추가한 건 한 줄 — 배지 + [삭제]. */
export function ManualRow(props: {
  item: ManualItem;
  reportId: string | null;
  editable: boolean;
}) {
  const { item, reportId, editable } = props;
  const { pending, error, run } = useSave();
  const period = periodOf(item);
  return (
    <li className="flex flex-col gap-1 px-2 py-2 hover:bg-line-soft">
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink">
        <span className={BADGE_CLASS}>직접 추가</span>
        {item.leave_kind ? (
          <span className="text-xs text-muted">{item.leave_kind}</span>
        ) : null}
        <span className="font-medium">{item.title}</span>
        {period ? (
          <span className="text-xs tabular-nums text-muted">{period}</span>
        ) : null}
        {editable && reportId !== null ? (
          <button
            type="button"
            disabled={pending}
            className={`${BTN_CLASS} ml-auto`}
            onClick={() =>
              run(() => removeManualItem({ reportId, itemId: item.id }))
            }
          >
            삭제
          </button>
        ) : null}
      </div>
      {item.note ? <p className="text-xs text-muted">{item.note}</p> : null}
      {error ? <p className={ERROR_CLASS}>{error}</p> : null}
    </li>
  );
}
