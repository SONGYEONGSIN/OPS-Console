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
 * SimpleTable — LiveCard 안 mini-table. list-variant Table(services 등)과 톤 통일:
 * - text-sm body / text-xs 헤더 / px-3 py-2 padding
 * - 첫 컬럼은 font-medium text-ink, 나머지는 text-ink-soft
 * - hover:bg-washi-raised + selected bg-washi-raised
 * - 빈 상태는 colSpan tr (table 구조 유지)
 */
export function SimpleTable({ columns, rows, selectedId, onRowClick }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
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
        {rows.length === 0 ? (
          <tr>
            <td
              colSpan={columns.length}
              className="px-3 py-6 text-center text-muted"
            >
              데이터 없음
            </td>
          </tr>
        ) : (
          rows.map((row) => {
            const selected = selectedId === row.id;
            return (
              <tr
                key={row.id}
                onClick={() => onRowClick(row.id)}
                className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                  selected ? "bg-washi-raised" : ""
                }`}
              >
                {columns.map((col, ci) => {
                  const v = row[col.key];
                  const isFirst = ci === 0;
                  return (
                    <td
                      key={col.key}
                      className={`px-3 py-2 truncate ${
                        col.alignRight ? "text-right font-mono" : ""
                      } ${
                        isFirst
                          ? "font-medium text-ink"
                          : "text-ink-soft"
                      }`}
                    >
                      {v == null ? "—" : String(v)}
                    </td>
                  );
                })}
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
