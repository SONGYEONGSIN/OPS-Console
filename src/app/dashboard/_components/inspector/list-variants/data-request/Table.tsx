"use client";

import type { ListRow } from "../../../patterns/ListPattern";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

export function DataRequestTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">대학명</th>
          <th className="px-3 py-2">서비스명</th>
          <th className="px-3 py-2">운영자</th>
          <th className="px-3 py-2">개발자</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={4} className="px-3 py-6 text-center text-muted">
              담당 서비스가 없습니다.
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onSelect(row)}
              className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                selectedId === row.id ? "bg-washi-raised" : ""
              }`}
            >
              <td className="px-3 py-2 font-medium text-ink">{row.universityName ?? "—"}</td>
              <td className="px-3 py-2 text-ink">{row.serviceName ?? row.name}</td>
              <td className="px-3 py-2 text-ink-soft">{row.operatorName ?? "—"}</td>
              <td className="px-3 py-2 text-ink-soft">{row.developerName ?? "—"}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
