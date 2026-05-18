import type { ViewProps } from "../types";
import type { ListRow } from "../../../patterns/ListPattern";

type ScheduleType = NonNullable<ListRow["scheduleType"]>;

const SCHEDULE_TYPE_LABEL: Record<ScheduleType, string> = {
  shift: "시프트",
  event: "이벤트",
  leave: "휴가",
  training: "교육",
};

const SCHEDULE_TYPE_COLOR: Record<ScheduleType, string> = {
  shift: "bg-vermilion text-cream",
  event: "bg-ink text-cream",
  leave: "bg-line-soft text-muted",
  training: "bg-washi-raised text-ink",
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
  return (
    <div className="space-y-5 text-sm text-ink">
      <section className="space-y-1.5">
        <p className="text-2xs uppercase tracking-[0.18em] text-muted">메타</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {type ? (
            <span
              className={`inline-block px-2 py-0.5 text-2xs ${SCHEDULE_TYPE_COLOR[type]}`}
            >
              {SCHEDULE_TYPE_LABEL[type]}
            </span>
          ) : null}
          {row.allDay ? (
            <span className="inline-block border border-line bg-transparent px-2 py-0.5 text-2xs text-ink">
              종일
            </span>
          ) : null}
          <span className="text-xs">
            <span className="text-muted">시각</span>{" "}
            <span className="font-mono text-ink">
              {formatScheduleRange(row.start_at, row.end_at, row.allDay)}
            </span>
          </span>
          <span className="text-xs">
            <span className="text-muted">담당</span>{" "}
            <span className="text-ink">{row.owner || "팀 공통"}</span>
          </span>
        </div>
      </section>

      {row.body ? (
        <section className="space-y-1.5">
          <p className="text-2xs uppercase tracking-[0.18em] text-muted">설명</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {row.body}
          </p>
        </section>
      ) : null}
    </div>
  );
}
