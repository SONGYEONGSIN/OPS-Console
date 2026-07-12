"use client";

import type { ListRow } from "../../../patterns/ListPattern";

type ScheduleType = NonNullable<ListRow["scheduleType"]>;

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

const SCHEDULE_TYPE_LABEL: Record<ScheduleType, string> = {
  shift: "시프트",
  event: "이벤트",
  leave: "휴가",
  training: "교육",
  application: "원서접수",
  pims: "PIMS",
  external_meeting: "외부미팅",
};

const SCHEDULE_TYPE_COLOR: Record<ScheduleType, string> = {
  shift: "bg-vermilion text-cream",
  event: "bg-ink text-cream",
  leave: "bg-line-soft text-muted",
  training: "bg-washi-raised text-ink",
  application: "bg-vermilion-deep text-cream",
  pims: "bg-gold text-cream",
  external_meeting: "bg-indigo text-cream",
};

function formatScheduleRange(
  start?: string,
  end?: string | null,
  allDay?: boolean,
): string {
  if (!start) return "-";
  const tz = "Asia/Seoul";
  const startD = new Date(start);
  const endD = end ? new Date(end) : null;
  const dayFmt = new Intl.DateTimeFormat("ko-KR", {
    timeZone: tz,
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
  const timeFmt = new Intl.DateTimeFormat("ko-KR", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const isoDate = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
  if (allDay) {
    if (!endD || isoDate(startD) === isoDate(endD))
      return dayFmt.format(startD);
    return `${dayFmt.format(startD)} ~ ${dayFmt.format(endD)}`;
  }
  if (!endD) return `${dayFmt.format(startD)} ${timeFmt.format(startD)}`;
  if (isoDate(startD) === isoDate(endD)) {
    return `${dayFmt.format(startD)} ${timeFmt.format(startD)}~${timeFmt.format(endD)}`;
  }
  return `${dayFmt.format(startD)} ${timeFmt.format(startD)} ~ ${dayFmt.format(endD)} ${timeFmt.format(endD)}`;
}

export function ScheduleTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">시각</th>
          <th className="px-3 py-2">타입</th>
          <th className="px-3 py-2">제목</th>
          <th className="px-3 py-2">담당</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={4} className="px-3 py-6 text-center text-muted">
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
              <td className="px-3 py-2 text-sm text-ink">
                {formatScheduleRange(row.start_at, row.end_at, row.allDay)}
              </td>
              <td className="px-3 py-2">
                {row.scheduleType && (
                  <span
                    className={`inline-block px-2 py-0.5 text-xs ${SCHEDULE_TYPE_COLOR[row.scheduleType]}`}
                  >
                    {SCHEDULE_TYPE_LABEL[row.scheduleType]}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
              <td className="px-3 py-2 text-sm text-ink-soft">
                {row.owner || "팀 공통"}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
