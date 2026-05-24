import type { ReactNode } from "react";
import { Section, DefList, Divider } from "../shared";
import type { ViewProps } from "../types";
import type { ListRow } from "../../../patterns/ListPattern";

type ScheduleType = NonNullable<ListRow["scheduleType"]>;

const SCHEDULE_TYPE_LABEL: Record<ScheduleType, string> = {
  shift: "시프트",
  event: "이벤트",
  leave: "휴가",
  training: "교육",
  application: "원서접수",
  pims: "PIMS",
};

const SCHEDULE_TYPE_COLOR: Record<ScheduleType, string> = {
  shift: "bg-vermilion text-cream",
  event: "bg-ink text-cream",
  leave: "bg-line-soft text-muted",
  training: "bg-washi-raised text-ink",
  application: "bg-vermilion-deep text-cream",
  pims: "bg-gold text-cream",
};

const TZ = "Asia/Seoul";

const DAY_FMT = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TZ,
  month: "numeric",
  day: "numeric",
  weekday: "short",
});
const TIME_FMT = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const ISO_DATE_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });

function formatScheduleRange(
  start?: string,
  end?: string | null,
  allDay?: boolean,
): string {
  if (!start) return "-";
  const startD = new Date(start);
  const endD = end ? new Date(end) : null;
  if (allDay) {
    if (!endD || ISO_DATE_FMT.format(startD) === ISO_DATE_FMT.format(endD))
      return DAY_FMT.format(startD);
    return `${DAY_FMT.format(startD)} ~ ${DAY_FMT.format(endD)}`;
  }
  if (!endD) return `${DAY_FMT.format(startD)} ${TIME_FMT.format(startD)}`;
  if (ISO_DATE_FMT.format(startD) === ISO_DATE_FMT.format(endD)) {
    return `${DAY_FMT.format(startD)} ${TIME_FMT.format(startD)}~${TIME_FMT.format(endD)}`;
  }
  return `${DAY_FMT.format(startD)} ${TIME_FMT.format(startD)} ~ ${DAY_FMT.format(endD)} ${TIME_FMT.format(endD)}`;
}

export function ScheduleView({ row }: ViewProps) {
  const type = row.scheduleType as ScheduleType | undefined;
  const basicItems: { term: string; desc: ReactNode }[] = [
    {
      term: "분류",
      desc: type ? (
        <span
          className={`inline-block px-2 py-0.5 text-xs ${SCHEDULE_TYPE_COLOR[type]}`}
        >
          {SCHEDULE_TYPE_LABEL[type]}
        </span>
      ) : (
        "-"
      ),
    },
    {
      term: "시각",
      desc: (
        <span className="font-mono text-sm">
          {formatScheduleRange(row.start_at, row.end_at, row.allDay)}
        </span>
      ),
    },
    {
      term: "종일여부",
      desc: row.allDay ? (
        <span className="inline-block bg-ink px-2 py-0.5 text-xs text-cream">
          종일
        </span>
      ) : (
        <span className="text-xs text-muted">시간 지정</span>
      ),
    },
    { term: "담당", desc: row.owner || "팀 공통" },
  ];

  return (
    <div className="space-y-6">
      <Section title="일정 기본">
        <DefList items={basicItems} />
      </Section>

      {row.body ? (
        <>
          <Divider />
          <Section title="설명">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {row.body}
            </p>
          </Section>
        </>
      ) : null}
    </div>
  );
}
