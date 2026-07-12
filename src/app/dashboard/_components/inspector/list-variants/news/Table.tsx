"use client";

import type { ListRow } from "../../../patterns/ListPattern";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

function formatDate(iso?: string | null): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function NewsTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">출처</th>
          <th className="px-3 py-2">제목</th>
          <th className="px-3 py-2">게시일</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={3} className="px-3 py-6 text-center text-muted">
              수집된 뉴스 없음
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onSelect(row)}
              className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                selectedId === row.id ? "bg-vermilion/10" : ""
              }`}
            >
              <td className="px-3 py-2 text-xs text-muted">
                {row.newsSource || "-"}
              </td>
              <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
              <td className="px-3 py-2 text-sm text-ink-soft">
                {formatDate(row.newsPublishedAt)}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
