"use client";

import type { ListRow } from "../../../patterns/ListPattern";
import { QUOTE_STATUS_LABEL } from "@/features/quotes/schemas";
import { operatorNameByEmail } from "@/features/auth/operators";
import { formatKrw } from "./filters";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

const STATUS_TONE: Record<string, string> = {
  draft: "bg-washi-raised text-muted",
  sent: "bg-vermilion/15 text-vermilion",
  won: "bg-sage/15 text-sage",
  lost: "bg-washi-raised text-ink-soft",
};

export function QuoteTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">고객</th>
          <th className="px-3 py-2">견적일</th>
          <th className="px-3 py-2">금액</th>
          <th className="px-3 py-2">담당</th>
          <th className="px-3 py-2">상태</th>
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
            const qs = row.quoteStatus ?? "draft";
            const label = QUOTE_STATUS_LABEL[qs];
            const tone = STATUS_TONE[qs] ?? "bg-washi-raised text-muted";
            return (
              <tr
                key={row.id}
                onClick={() => onSelect(row)}
                className={`cursor-pointer border-b border-line-soft hover:bg-line-soft ${
                  selectedId === row.id ? "bg-vermilion/10" : ""
                }`}
              >
                <td className="px-3 py-2 font-medium text-ink">
                  {row.quoteCustomer ?? row.name}
                </td>
                <td className="px-3 py-2 text-xs text-ink-soft">
                  {row.quoteDate ?? "—"}
                </td>
                <td className="px-3 py-2 text-xs text-ink-soft">
                  {formatKrw(row.quoteAmount)}
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {operatorNameByEmail(row.quoteOwner) || "—"}
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-block px-2 py-0.5 text-2xs ${tone}`}>
                    {label}
                  </span>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
