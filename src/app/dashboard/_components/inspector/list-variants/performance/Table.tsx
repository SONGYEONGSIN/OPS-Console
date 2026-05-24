"use client";

import type { ListRow } from "../../../patterns/ListPattern";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

const STEP_LABEL: Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, string> = {
  1: "목표설정",
  2: "실행계획",
  3: "계획검토",
  4: "중간점검",
  5: "점검검토",
  6: "자기평가",
  7: "종합평가",
  8: "완료",
};

/** performance 도메인 테이블 — 사이클 / 평가자 / 팀원 / 현재 단계 / 진척률. */
export function PerformanceTable({ rows, selectedId, onSelect }: Props) {
  return (
    <div className="overflow-hidden border border-ink bg-washi-raised">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border-b border-ink bg-washi px-3 py-2.5 text-left text-xs font-bold text-ink-soft">
              사이클
            </th>
            <th className="w-32 border-b border-ink bg-washi px-3 py-2.5 text-left text-xs font-bold text-ink-soft">
              평가자
            </th>
            <th className="w-32 border-b border-ink bg-washi px-3 py-2.5 text-left text-xs font-bold text-ink-soft">
              팀원
            </th>
            <th className="w-28 border-b border-ink bg-washi px-3 py-2.5 text-left text-xs font-bold text-ink-soft">
              현재 단계
            </th>
            <th className="w-24 border-b border-ink bg-washi px-3 py-2.5 text-right text-xs font-bold text-ink-soft">
              진척률
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-3 py-12 text-center text-sm text-ink-muted"
              >
                평가 데이터가 없습니다.
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const step = row.performanceCurrentStep ?? 1;
              const percent = Math.round((step / 8) * 100);
              return (
                <tr
                  key={row.id}
                  onClick={() => onSelect(row)}
                  data-selected={row.id === selectedId ? "true" : "false"}
                  className="cursor-pointer border-b border-line-soft bg-washi-raised transition-colors last:border-b-0 hover:bg-washi data-[selected=true]:bg-washi"
                >
                  <td className="px-3 py-3 align-middle text-sm font-medium text-ink">
                    {row.performanceCycleName ?? row.name ?? "-"}
                  </td>
                  <td className="px-3 py-3 align-middle text-sm text-ink-soft">
                    {row.performanceEvaluatorName ?? "-"}
                  </td>
                  <td className="px-3 py-3 align-middle text-sm text-ink-soft">
                    {row.performanceEvaluateeName ?? "-"}
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <span className="inline-block border border-ink bg-cream px-2 py-0.5 text-xs text-ink">
                      {step}. {STEP_LABEL[step]}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right align-middle text-xs text-ink-muted tabular-nums">
                    {percent}%
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
