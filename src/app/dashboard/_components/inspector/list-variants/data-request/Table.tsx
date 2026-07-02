"use client";

import type { ListRow } from "../../../patterns/ListPattern";

function formatMonthDay(iso?: string | null): string {
  if (!iso) return "—";
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const mm = parts.find((p) => p.type === "month")?.value;
  const dd = parts.find((p) => p.type === "day")?.value;
  return mm && dd ? `${mm}-${dd}` : "—";
}

/** 발송일시(ISO)를 KST 'MM-DD HH:mm'으로 포맷. 없으면 '—'. */
function formatSendDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  const mm = get("month");
  const dd = get("day");
  const hh = get("hour");
  const mi = get("minute");
  return mm && dd && hh && mi ? `${mm}-${dd} ${hh}:${mi}` : "—";
}

/** 작성시작(시즌 보정된 전체 날짜)이 now 이전이면 true. iso는 page에서 +1년 보정된 값. */
export function isWriteStartPast(iso: string | null | undefined, now: Date): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < now.getTime();
}

function StatusBadge({ status }: { status?: "scheduled" | "sent" | null }) {
  if (status === "scheduled")
    return (
      <span className="inline-block bg-vermilion px-2 py-0.5 text-2xs text-cream">
        예약완료
      </span>
    );
  if (status === "sent")
    return (
      <span className="inline-block bg-ink px-2 py-0.5 text-2xs text-cream">
        발송완료
      </span>
    );
  return <span className="text-ink-soft">—</span>;
}

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

export function DataRequestTable({ rows, selectedId, onSelect }: Props) {
  const now = new Date();
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">대학명</th>
          <th className="px-3 py-2">서비스명</th>
          <th className="px-3 py-2">작성시작</th>
          <th className="px-3 py-2">상태</th>
          <th className="px-3 py-2">발송일자</th>
          <th className="px-3 py-2">운영자</th>
          <th className="px-3 py-2">개발자</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={7} className="px-3 py-6 text-center text-muted">
              담당 서비스가 없습니다.
            </td>
          </tr>
        ) : (
          rows.map((row) => {
            const past = isWriteStartPast(row.writeStartAt, now);
            return (
              <tr
                key={row.id}
                onClick={past ? undefined : () => onSelect(row)}
                aria-disabled={past || undefined}
                className={
                  past
                    ? "border-b border-line-soft bg-washi opacity-60 cursor-not-allowed"
                    : `cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                        selectedId === row.id ? "bg-washi-raised" : ""
                      }`
                }
              >
                <td className="px-3 py-2 font-medium text-ink">{row.universityName ?? "—"}</td>
                <td className="px-3 py-2 text-ink">{row.serviceName ?? row.name}</td>
                <td className="px-3 py-2 text-ink-soft">{formatMonthDay(row.writeStartAt)}</td>
                <td className="px-3 py-2"><StatusBadge status={row.dataRequestStatus} /></td>
                <td className="px-3 py-2 text-ink-soft">{formatSendDateTime(row.dataRequestLastSentAt)}</td>
                <td className="px-3 py-2 text-ink-soft">{row.operatorName ?? "—"}</td>
                <td className="px-3 py-2 text-ink-soft">{row.developerName ?? "—"}</td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
