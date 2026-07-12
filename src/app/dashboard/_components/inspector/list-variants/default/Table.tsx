"use client";

import type { ListRow } from "../../../patterns/ListPattern";
import { STATUS_LABEL, STATUS_COLOR } from "../status";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

export function DefaultTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">ID</th>
          <th className="px-3 py-2">이름</th>
          <th className="px-3 py-2">상태</th>
          <th className="px-3 py-2">담당</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={4} className="px-3 py-6 text-center text-muted">
              데이터 없음
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onSelect(row)}
              className={`cursor-pointer border-b border-line-soft hover:bg-line-soft ${
                selectedId === row.id ? "bg-vermilion/10" : ""
              } ${row.status === "deleted" ? "opacity-50 [&_td]:line-through" : ""}`}
            >
              <td className="px-3 py-2 font-mono text-xs text-muted">
                {row.id}
              </td>
              <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
              <td className="px-3 py-2">
                <span
                  className={`inline-block px-2 py-0.5 text-xs ${STATUS_COLOR[row.status]}`}
                >
                  {STATUS_LABEL[row.status]}
                </span>
              </td>
              <td className="px-3 py-2 text-sm text-ink-soft">{row.owner}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
