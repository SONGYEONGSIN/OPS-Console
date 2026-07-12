"use client";

import type { ListRow } from "../../../patterns/ListPattern";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

/** 활성화 뱃지 — 재직(중립) / 타부서 이동(faint) */
function activeTone(active?: string): string {
  if (active === "타부서 이동") return "text-muted";
  return "text-ink";
}

export function ContactsTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">활성화</th>
          <th className="px-3 py-2">고객명</th>
          <th className="px-3 py-2">직함</th>
          <th className="px-3 py-2">대학명</th>
          <th className="px-3 py-2">소속부서</th>
          <th className="px-3 py-2">직책</th>
          <th className="px-3 py-2">관리등급</th>
          <th className="px-3 py-2">관계등급</th>
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
              className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                selectedId === row.id ? "bg-vermilion/10" : ""
              }`}
            >
              <td className={`px-3 py-2 text-sm ${activeTone(row.customerActive)}`}>
                {row.customerActive ?? "-"}
              </td>
              <td className="px-3 py-2 font-medium text-ink">
                {row.name || "-"}
              </td>
              <td className="px-3 py-2 text-sm text-ink-soft">
                {row.jobTitle || "-"}
              </td>
              <td className="px-3 py-2 text-sm text-ink">
                {row.universityName || "-"}
              </td>
              <td className="px-3 py-2 text-sm text-ink-soft">
                {row.departmentName || "-"}
              </td>
              <td className="px-3 py-2 text-sm text-ink-soft">
                {row.jobRole || "-"}
              </td>
              <td className="px-3 py-2">
                {row.managementGrade ? (
                  <span className="inline-block bg-washi-raised px-2 py-0.5 text-xs text-ink">
                    {row.managementGrade}
                  </span>
                ) : (
                  <span className="text-xs text-muted">-</span>
                )}
              </td>
              <td className="px-3 py-2">
                {row.relationshipGrade ? (
                  <span className="inline-block bg-line-soft px-2 py-0.5 text-xs text-ink">
                    {row.relationshipGrade}
                  </span>
                ) : (
                  <span className="text-xs text-muted">-</span>
                )}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
