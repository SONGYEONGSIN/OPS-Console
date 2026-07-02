"use client";

import type { ListRow } from "../../../patterns/ListPattern";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

/** 계약진행현황 text → tone. 빈 값(미완료)는 vermilion으로 강조 */
function statusTone(status?: string): string {
  if (!status) return "text-vermilion";
  if (status.includes("완료")) return "text-ink";
  return "text-ink-soft";
}

export function ContractsTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">시트</th>
          <th className="px-3 py-2">넘버링</th>
          <th className="px-3 py-2">대학·학교명</th>
          <th className="px-3 py-2">운영자</th>
          <th className="px-3 py-2">계약현황</th>
          <th className="px-3 py-2">서비스</th>
          <th className="px-3 py-2">수수료</th>
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
          rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onSelect(row)}
              className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                selectedId === row.id ? "bg-washi-raised" : ""
              }`}
            >
              <td className="px-3 py-2">
                <span className="inline-block bg-washi-raised px-2 py-0.5 text-xs text-ink">
                  {row.contractSheet ?? "-"}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-ink-soft">
                {row.numbering || "-"}
              </td>
              <td className="px-3 py-2 font-medium text-ink">
                {row.name || "-"}
              </td>
              <td className="px-3 py-2 text-sm text-ink-soft">
                {row.owner || "-"}
              </td>
              <td className={`px-3 py-2 text-sm ${statusTone(row.contractStatus)}`}>
                {row.contractStatus || "미완료"}
              </td>
              <td className="px-3 py-2">
                {row.serviceActive === "Y" ? (
                  <span className="inline-block bg-line-soft px-2 py-0.5 text-xs text-ink">
                    Y
                  </span>
                ) : (
                  <span className="text-xs text-muted">-</span>
                )}
              </td>
              <td className="px-3 py-2 text-sm text-ink-soft">
                {row.feeAmount || "-"}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
