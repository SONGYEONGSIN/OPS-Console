"use client";

import type { ListRow } from "../../../patterns/ListPattern";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

function formatShortDate(iso?: string | null): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
  }).format(new Date(iso));
}

/**
 * 작성마감까지 남은 일수 표기 (D-N). 지난 일정은 '마감'(closed=true).
 */
function deadlineBadge(iso?: string | null): {
  label: string;
  tone: string;
  closed: boolean;
} {
  if (!iso) return { label: "-", tone: "text-muted", closed: false };
  const now = Date.now();
  const target = new Date(iso).getTime();
  const diffDays = Math.ceil((target - now) / (24 * 60 * 60 * 1000));
  if (diffDays < 0)
    return { label: "마감", tone: "bg-washi-raised text-muted", closed: true };
  if (diffDays <= 7)
    return {
      label: `D-${diffDays}`,
      tone: "text-vermilion font-semibold",
      closed: false,
    };
  return { label: `D-${diffDays}`, tone: "text-ink-soft", closed: false };
}

export function ServicesTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">대학명</th>
          <th className="px-3 py-2">서비스명</th>
          <th className="px-3 py-2">카테고리</th>
          <th className="px-3 py-2">운영자</th>
          <th className="px-3 py-2">작성마감</th>
          <th className="px-3 py-2">남은일수</th>
          <th className="px-3 py-2">단독</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={7} className="px-3 py-6 text-center text-muted">
              데이터 없음
            </td>
          </tr>
        ) : (
          rows.map((row) => {
            const badge = deadlineBadge(row.writeEndAt);
            return (
              <tr
                key={row.id}
                onClick={() => onSelect(row)}
                className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                  selectedId === row.id ? "bg-vermilion/10" : ""
                } ${row.status === "deleted" ? "opacity-50 [&_td]:line-through" : ""}`}
              >
                <td className="px-3 py-2 font-medium text-ink">
                  {row.universityName ?? "-"}
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {row.serviceName ?? "-"}
                </td>
                <td className="px-3 py-2">
                  {row.category ? (
                    <span className="inline-block bg-washi-raised px-2 py-0.5 text-xs text-ink">
                      {row.category}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">-</span>
                  )}
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {row.operatorName || row.operatorEmail || "-"}
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {formatShortDate(row.writeEndAt)}
                </td>
                <td className="px-3 py-2 text-sm">
                  {badge.closed ? (
                    <span
                      className={`inline-block px-1.5 py-0.5 text-xs ${badge.tone}`}
                    >
                      {badge.label}
                    </span>
                  ) : (
                    <span className={`text-xs ${badge.tone}`}>
                      {badge.label}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {row.solo ? (
                    <span className="inline-block bg-vermilion px-2 py-0.5 text-xs text-cream">
                      단독
                    </span>
                  ) : (
                    <span className="text-xs text-muted">-</span>
                  )}
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
