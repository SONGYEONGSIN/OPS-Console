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
  external_meeting: "외부미팅",
  meeting: "회의",
};

const SCHEDULE_TYPE_COLOR: Record<ScheduleType, string> = {
  shift: "bg-vermilion text-cream",
  event: "bg-ink text-cream",
  leave: "bg-line-soft text-muted",
  training: "bg-washi-raised text-ink",
  application: "bg-vermilion-deep text-cream",
  pims: "bg-gold text-cream",
  external_meeting: "bg-indigo text-cream",
  meeting: "bg-sage text-cream",
};

const TZ = "Asia/Seoul";

/** services 시즌과 동일 톤: 'YYYY. MM. DD. HH:MM' (allDay 시 시간 생략). */
function formatDateTime(iso?: string | null, allDay?: boolean): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(allDay ? {} : { hour: "2-digit", minute: "2-digit", hour12: false }),
  }).format(new Date(iso));
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

  const timeItems: { term: string; desc: ReactNode }[] = [
    { term: "시작", desc: formatDateTime(row.start_at, row.allDay) },
    { term: "종료", desc: formatDateTime(row.end_at, row.allDay) },
  ];

  return (
    <div className="space-y-6">
      <Section title="기본">
        <DefList items={basicItems} />
      </Section>

      <Divider />

      <Section title="시간">
        <DefList items={timeItems} />
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
