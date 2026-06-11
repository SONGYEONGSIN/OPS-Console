/**
 * 오늘의 타임라인 좌표 계산 (순수 함수, KST 기준).
 *
 * 09:00~18:00(기본) 가로 축에서 각 이벤트/현재 시각을 leftPct(0~100)로 매핑한다.
 * - "HH:mm" 입력은 KST 벽시계 시각 그대로 사용
 * - ISO(오프셋 포함) 입력은 Asia/Seoul 로 변환 후 분(minute) 계산
 */

export type TimelineKind = "due" | "mail" | "sch";

export type TimelineEvent = {
  id: string;
  label: string;
  kind: TimelineKind;
  /** ISO 8601(오프셋 권장) 또는 "HH:mm" */
  at: string;
};

export type TimelinePoint = {
  id: string;
  label: string;
  kind: TimelineKind;
  /** 0~100 으로 clamp 된 가로 위치(%) */
  leftPct: number;
};

export type TimelineOptions = {
  dayStartHour?: number;
  dayEndHour?: number;
};

const KST = "Asia/Seoul";
const HHMM = /^(\d{1,2}):(\d{2})$/;

/** KST 벽시계 기준, 자정으로부터 경과한 분(minute). */
function minutesOfDayKst(value: string): number {
  const hhmm = HHMM.exec(value);
  if (hhmm) {
    return Number(hhmm[1]) * 60 + Number(hhmm[2]);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`잘못된 시각 형식입니다: ${value}`);
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KST,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

const clampPct = (pct: number): number => Math.min(100, Math.max(0, pct));

function toLeftPct(value: string, startMin: number, spanMin: number): number {
  const minutes = minutesOfDayKst(value);
  return clampPct(((minutes - startMin) / spanMin) * 100);
}

export function computeTimeline(
  events: TimelineEvent[],
  nowIso: string,
  opts: TimelineOptions = {},
): { points: TimelinePoint[]; nowPct: number } {
  const startHour = opts.dayStartHour ?? 9;
  const endHour = opts.dayEndHour ?? 18;
  const startMin = startHour * 60;
  const spanMin = (endHour - startHour) * 60;

  const points: TimelinePoint[] = events.map((event) => ({
    id: event.id,
    label: event.label,
    kind: event.kind,
    leftPct: toLeftPct(event.at, startMin, spanMin),
  }));

  const nowPct = toLeftPct(nowIso, startMin, spanMin);

  return { points, nowPct };
}
