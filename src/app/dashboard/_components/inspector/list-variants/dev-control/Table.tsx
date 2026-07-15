"use client";

import type { ListRow } from "../../../patterns/ListPattern";
import type { DevControlAnalysis } from "@/features/dev-controls/schemas";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

function formatMonthDay(iso?: string | null): string {
  if (!iso) return "—";
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const mm = parts.find((p) => p.type === "month")?.value;
  const dd = parts.find((p) => p.type === "day")?.value;
  return mm && dd ? `${mm}-${dd}` : "—";
}

/** A/AU 파일 수 배지 — 각 kind별 count. 0건이면 배지 생략. */
function FileCountBadges({ analyses }: { analyses: DevControlAnalysis[] }) {
  const aCount = analyses.filter((a) => a.kind === "A").length;
  const auCount = analyses.filter((a) => a.kind === "AU").length;
  return (
    <div className="flex items-center gap-1">
      {aCount > 0 && (
        <span className="inline-block bg-ink px-1.5 py-0.5 text-2xs text-cream">
          A {aCount}
        </span>
      )}
      {auCount > 0 && (
        <span className="inline-block bg-vermilion px-1.5 py-0.5 text-2xs text-cream">
          AU {auCount}
        </span>
      )}
    </div>
  );
}

/** 미체크 flag 합계 배지 — 0건이면 '—'. */
function UncheckedBadge({ analyses }: { analyses: DevControlAnalysis[] }) {
  const count = analyses.reduce(
    (sum, a) => sum + a.flags.filter((f) => !f.checked).length,
    0,
  );
  if (count === 0) return <span className="text-ink-soft">—</span>;
  return (
    <span className="inline-block bg-vermilion px-2 py-0.5 text-2xs text-cream">
      {count}건
    </span>
  );
}

/** 최근 분석일 — analyzed_at 최대값. */
function latestAnalyzedAt(analyses: DevControlAnalysis[]): string | null {
  if (analyses.length === 0) return null;
  return analyses.reduce((a, b) => (a.analyzed_at >= b.analyzed_at ? a : b))
    .analyzed_at;
}

export function DevControlTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">대학명</th>
          <th className="px-3 py-2">서비스명</th>
          <th className="px-3 py-2">제어파일</th>
          <th className="px-3 py-2">확인 필요</th>
          <th className="px-3 py-2">최근 분석일</th>
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
            const analyses = row.devControlAnalyses ?? [];
            const hasAnalyses = analyses.length > 0;
            return (
              <tr
                key={row.id}
                onClick={() => onSelect(row)}
                className={`cursor-pointer border-b border-line-soft hover:bg-line-soft ${
                  selectedId === row.id ? "bg-vermilion/10" : ""
                }`}
              >
                <td className="px-3 py-2 font-medium text-ink">
                  {row.universityName ?? "—"}
                </td>
                <td className="px-3 py-2 text-ink-soft">
                  {row.serviceName ?? row.name}
                </td>
                <td className="px-3 py-2">
                  {hasAnalyses ? (
                    <FileCountBadges analyses={analyses} />
                  ) : (
                    <span className="text-xs text-muted">미수집</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {hasAnalyses ? (
                    <UncheckedBadge analyses={analyses} />
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-ink-soft">
                  {hasAnalyses
                    ? formatMonthDay(latestAnalyzedAt(analyses))
                    : "—"}
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
