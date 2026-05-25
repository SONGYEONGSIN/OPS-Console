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

function formatSize(bytes?: number | null): string {
  if (bytes == null) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function categoryLabel(category: string | null | undefined): string {
  return category ?? "기타";
}

export function ManualTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">이름</th>
          <th className="px-3 py-2">카테고리</th>
          <th className="px-3 py-2">종류</th>
          <th className="px-3 py-2">수정일</th>
          <th className="px-3 py-2">크기</th>
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
            const isFolder = row.manualKind === "folder";
            return (
              <tr
                key={row.id}
                onClick={() => onSelect(row)}
                className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                  selectedId === row.id ? "bg-washi-raised" : ""
                }`}
              >
                <td className="px-3 py-2 font-medium text-ink">
                  <span className="mr-2 text-muted">{isFolder ? "▦" : "§"}</span>
                  {row.name}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-block bg-washi-raised px-2 py-0.5 text-xs text-ink">
                    {categoryLabel(row.manualCategory)}
                  </span>
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {isFolder ? "폴더" : "파일"}
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {formatShortDate(row.manualModified)}
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {formatSize(row.manualSize)}
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
