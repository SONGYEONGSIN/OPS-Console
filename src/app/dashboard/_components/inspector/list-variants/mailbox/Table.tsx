"use client";

import type { ListRow } from "../../../patterns/ListPattern";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

function formatTime(iso?: string | null): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function MailboxTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">상태</th>
          <th className="px-3 py-2">발신자</th>
          <th className="px-3 py-2">제목</th>
          <th className="px-3 py-2">초안</th>
          <th className="px-3 py-2">수신</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={5} className="px-3 py-6 text-center text-muted">
              수신 메일 없음
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
              <td className="px-3 py-2 text-sm">
                <span
                  className={row.mailIsRead ? "text-muted" : "text-vermilion"}
                >
                  {row.mailIsRead ? "○" : "●"}
                </span>
              </td>
              <td className="px-3 py-2 font-medium text-ink">
                {row.mailFromName || row.mailFromEmail || "-"}
              </td>
              <td className="px-3 py-2 text-sm text-ink">
                {row.mailSubject || "(제목 없음)"}
              </td>
              <td className="px-3 py-2">
                {row.mailHasDraft ? (
                  <span className="inline-block bg-line-soft px-2 py-0.5 text-xs text-ink">
                    {row.mailDraftStatus === "sent" ? "발송됨" : "✎ 초안"}
                  </span>
                ) : (
                  <span className="text-xs text-muted">-</span>
                )}
              </td>
              <td className="px-3 py-2 text-sm text-ink-soft">
                {formatTime(row.mailReceivedAt)}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
