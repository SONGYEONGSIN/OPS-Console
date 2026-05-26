"use client";

import type { ListRow } from "../../../patterns/ListPattern";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

const STATUS_TONE = {
  미처리: "bg-washi-raised text-muted",
  처리중: "bg-vermilion/15 text-vermilion",
  처리완료: "bg-sage/15 text-sage",
  보류: "bg-washi-raised text-ink-soft",
} as const;

export function IncidentTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">학년도</th>
          <th className="px-3 py-2">상태</th>
          <th className="px-3 py-2">구분</th>
          <th className="px-3 py-2">카테고리</th>
          <th className="px-3 py-2">사고제목</th>
          <th className="px-3 py-2">대학교</th>
          <th className="px-3 py-2">담당자</th>
          <th className="px-3 py-2">발생일자</th>
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
          rows.map((row) => {
            const status = row.incidentStatus ?? "미처리";
            return (
              <tr
                key={row.id}
                onClick={() => onSelect(row)}
                className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                  selectedId === row.id ? "bg-washi-raised" : ""
                }`}
              >
                <td className="px-3 py-2 text-xs text-ink-soft">
                  {row.incidentYear ? `${row.incidentYear}학년도` : "—"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block px-2 py-0.5 text-2xs ${STATUS_TONE[status]}`}
                  >
                    {status}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-ink-soft">
                  {row.incidentAppType ?? "—"}
                </td>
                <td className="px-3 py-2 text-xs text-ink-soft">
                  {row.incidentCategory ?? "—"}
                </td>
                <td className="px-3 py-2 font-medium text-ink">
                  {row.incidentTitle ?? row.name}
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {row.incidentUniversityName ?? "—"}
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {row.incidentAssigneeName ?? "—"}
                </td>
                <td className="px-3 py-2 text-xs text-ink-soft">
                  {row.incidentOccurredDate ?? "—"}
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
