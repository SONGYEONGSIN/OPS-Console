"use client";

import type { ListRow } from "../../../patterns/ListPattern";
import { SERVICE_KINDS } from "@/features/assignments/schemas";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

function cellText(row: ListRow, service: string): string {
  const rec = row.assignment?.byService[service];
  if (!rec || (!rec.operator && !rec.developer)) return "—";
  if (!rec.developer) return rec.operator || "—";
  return `${rec.operator || "—"} / ${rec.developer}`;
}

export function AssignmentsTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b-2 border-ink text-left text-xs text-muted">
          <th className="py-2 pr-3 font-medium">대학</th>
          {SERVICE_KINDS.map((s) => (
            <th key={s} className="py-2 pr-3 font-medium">{s}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            onClick={() => onSelect(row)}
            className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
              selectedId === row.id ? "bg-washi-raised" : ""
            }`}
          >
            <td className="py-2 pr-3 font-medium text-ink">{row.name}</td>
            {SERVICE_KINDS.map((s) => (
              <td key={s} className="py-2 pr-3 text-ink">{cellText(row, s)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
