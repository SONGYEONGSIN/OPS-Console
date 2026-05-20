"use client";

export type SimpleColumn = {
  key: string;
  label: string;
  /** Tailwind width class (예: "w-24") */
  width?: string;
  /** 우측 정렬 (수치 컬럼) */
  alignRight?: boolean;
};

export type SimpleRow = {
  id: string;
  [k: string]: string | number | null | undefined;
};

type Props = {
  columns: SimpleColumn[];
  rows: SimpleRow[];
  selectedId?: string | null;
  onRowClick: (id: string) => void;
};

/**
 * SimpleTable — LiveCard 안 통일된 mini-table.
 * list-variant Table 톤 (border-b border-line / hover:bg-washi-raised / selected bg-washi-raised).
 */
export function SimpleTable({ columns, rows, selectedId, onRowClick }: Props) {
  if (rows.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-xs text-muted">데이터 없음</p>
    );
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-line text-left text-2xs uppercase tracking-[0.06em] text-muted">
          {columns.map((col) => (
            <th
              key={col.key}
              className={`px-3 py-2 ${col.width ?? ""} ${col.alignRight ? "text-right" : ""}`}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const selected = selectedId === row.id;
          return (
            <tr
              key={row.id}
              onClick={() => onRowClick(row.id)}
              className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                selected ? "bg-washi-raised" : ""
              }`}
            >
              {columns.map((col) => {
                const v = row[col.key];
                return (
                  <td
                    key={col.key}
                    className={`px-3 py-2 ${col.alignRight ? "text-right font-mono" : ""} truncate`}
                  >
                    {v == null ? "—" : String(v)}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
