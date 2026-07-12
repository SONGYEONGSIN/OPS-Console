"use client";

import type { ListRow } from "../../../patterns/ListPattern";
import { elapsedDays } from "./helpers";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

export function ReceivablesTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="whitespace-nowrap px-3 py-2">청구일자</th>
          <th className="whitespace-nowrap px-3 py-2">거래처</th>
          <th className="whitespace-nowrap px-3 py-2">거래내역</th>
          <th className="whitespace-nowrap px-3 py-2">운영자</th>
          <th className="whitespace-nowrap px-3 py-2 text-right">경과일수</th>
          <th className="whitespace-nowrap px-3 py-2">학교 담당자 이메일</th>
          <th className="whitespace-nowrap px-3 py-2 text-right">청구금액</th>
          <th className="whitespace-nowrap px-3 py-2">입금여부</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={8} className="px-3 py-6 text-center text-muted">
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
              }`}
            >
              <td className="whitespace-nowrap px-3 py-2 text-sm text-ink-soft">
                {row.meta ?? "-"}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-medium text-ink">
                {row.name || "-"}
              </td>
              <td className="max-w-xs truncate px-3 py-2 text-sm text-ink-soft">
                {row.body ?? "-"}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-sm text-ink-soft">
                {row.owner || "-"}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right text-sm text-ink-soft">
                {(() => {
                  const d = elapsedDays(row.meta);
                  return d === null ? "-" : `${d}일`;
                })()}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-sm text-ink-soft">
                {row.receivablesCells?.schoolOwner || "-"}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right text-sm text-ink">
                {row.author ?? "-"}
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                <span
                  className={`inline-block px-2 py-0.5 text-xs ${
                    row.status === "approved"
                      ? "bg-washi-raised text-ink"
                      : "bg-vermilion/20 text-vermilion-deep"
                  }`}
                >
                  {row.status === "approved" ? "수금" : "미수"}
                </span>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
