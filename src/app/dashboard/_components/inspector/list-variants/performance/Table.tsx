"use client";

import type { ListRow } from "../../../patterns/ListPattern";
import {
  STEP_LABEL,
  STEP_VALUES,
  type Step,
} from "@/features/performance/schemas";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

const STEP_MAX = STEP_VALUES.length;

/** performance 도메인 테이블 — 사이클 / 평가자 / 팀원 / 현재 단계 / 진척률.
 *  표준 톤(ServicesTable) — 외부 border/bg 없이 row separator만. */
export function PerformanceTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">사이클</th>
          <th className="px-3 py-2">평가자</th>
          <th className="px-3 py-2">팀원</th>
          <th className="px-3 py-2">현재 단계</th>
          <th className="px-3 py-2 text-right">진척률</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={5} className="px-3 py-6 text-center text-muted">
              데이터 없음
            </td>
          </tr>
        ) : (
          rows.map((row) => {
            const step = (row.performanceCurrentStep ?? 1) as Step;
            const percent = Math.round((step / STEP_MAX) * 100);
            return (
              <tr
                key={row.id}
                onClick={() => onSelect(row)}
                className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                  selectedId === row.id ? "bg-washi-raised" : ""
                }`}
              >
                <td className="px-3 py-2 font-medium text-ink">
                  {row.performanceCycleName ?? row.name ?? "-"}
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {row.performanceEvaluatorName ?? "-"}
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {row.performanceEvaluateeName ?? "-"}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-block bg-washi-raised px-2 py-0.5 text-xs text-ink">
                    {step}. {STEP_LABEL[step]}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-xs text-muted tabular-nums">
                  {percent}%
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
