"use client";

import type { ListRow } from "../../../patterns/ListPattern";
import {
  MEETING_TYPE_LABELS,
  MEETING_STATUS_LABELS,
  type MeetingType,
  type MeetingStatus,
} from "@/features/meetings/schemas";
import { MEETING_STATUS_TONE } from "./status";
import { formatMeetingDateKst } from "@/features/meetings/format-meeting-date";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

export function MeetingTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">유형</th>
          <th className="px-3 py-2">제목</th>
          <th className="px-3 py-2">일시</th>
          <th className="px-3 py-2">작성자</th>
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
            const type = (row.meetingType ?? "regular") as MeetingType;
            const status = (row.meetingStatus ?? "draft") as MeetingStatus;
            return (
              <tr
                key={row.id}
                onClick={() => onSelect(row)}
                className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                  selectedId === row.id ? "bg-washi-raised" : ""
                }`}
              >
                <td className="px-3 py-2">
                  <span className="inline-block bg-washi-raised px-2 py-0.5 text-2xs text-ink-soft">
                    {MEETING_TYPE_LABELS[type]}
                  </span>
                </td>
                <td className="px-3 py-2 font-medium text-ink">
                  {row.meetingTitle ?? row.name}
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {formatMeetingDateKst(row.meetingDate)}
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {row.meetingAuthor ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block px-2 py-0.5 text-2xs ${MEETING_STATUS_TONE[status]}`}
                  >
                    {MEETING_STATUS_LABELS[status]}
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
