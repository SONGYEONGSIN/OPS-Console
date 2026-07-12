"use client";

import type { ListRow } from "../../../patterns/ListPattern";
import { REPORT_STATUS_LABEL } from "@/features/incident-reports/schemas";
import { STATUS_TONE } from "./status";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

export function IncidentReportTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">제목</th>
          <th className="px-3 py-2">수신대학</th>
          <th className="px-3 py-2">상태</th>
          <th className="px-3 py-2">작성자</th>
          <th className="px-3 py-2">팀장</th>
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
            const status = row.incidentReportStatus ?? "draft";
            return (
              <tr
                key={row.id}
                onClick={() => onSelect(row)}
                className={`cursor-pointer border-b border-line-soft hover:bg-line-soft ${
                  selectedId === row.id ? "bg-vermilion/10" : ""
                }`}
              >
                <td className="px-3 py-2 font-medium text-ink">
                  {row.incidentReportTitle ?? row.name}
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {row.incidentReportUniversity ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block px-2 py-0.5 text-2xs ${STATUS_TONE[status]}`}
                  >
                    {REPORT_STATUS_LABEL[status]}
                  </span>
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {row.incidentReportAuthorName ?? "—"}
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {row.incidentReportApproverName ?? "—"}
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
