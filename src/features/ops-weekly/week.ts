/**
 * 주간업무보고 주차 계산 — 본부 주간업무보고와 같은 **목요일 기준** 주차.
 * 라벨(`YYYY년 M월 N주차`)이 본부 파일 시트명과 글자 단위로 같아야 한다.
 * 날짜 산술은 전부 UTC 위의 `YYYY-MM-DD` 문자열로 해서 실행 TZ 에 흔들리지 않는다.
 */
import {
  floorMod,
  formatDateRange,
  pyWeekday,
  weekDateRange,
} from "@/features/automations/jobs/weekly-report/rollover-logic";
import { nextWeekRange, type WeekRange } from "@/features/closing/next-week";

export type YmdRange = WeekRange;

export type WeekRef = {
  weekStart: string;
  year: number;
  month: number;
  week: number;
  label: string;
  rangeLabel: string;
};

const DAY = 86_400_000;
const KST_OFFSET_MS = 9 * 3_600_000;
const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const KST_YMD = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 한국 날짜 `YYYY-MM-DD`. */
export function kstYmd(instant: Date): string {
  return KST_YMD.format(instant);
}

function parseYmd(ymd: string): Date | null {
  const m = YMD_RE.exec(ymd);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === ymd ? d : null;
}

function addDays(ymd: string, n: number): string {
  const d = parseYmd(ymd);
  if (!d) throw new Error(`잘못된 날짜: ${ymd}`);
  return new Date(d.getTime() + n * DAY).toISOString().slice(0, 10);
}

function refFromMonday(monday: Date): WeekRef {
  const thu = new Date(monday.getTime() + 3 * DAY);
  const year = thu.getUTCFullYear();
  const month = thu.getUTCMonth() + 1;
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstThu = new Date(
    first.getTime() + floorMod(3 - pyWeekday(first), 7) * DAY,
  );
  const week = Math.round((thu.getTime() - firstThu.getTime()) / DAY / 7) + 1;
  const range = weekDateRange(year, month, week);
  return {
    weekStart: monday.toISOString().slice(0, 10),
    year,
    month,
    week,
    label: `${year}년 ${month}월 ${week}주차`,
    rangeLabel: formatDateRange(range.monday, range.friday),
  };
}

export function weekOf(instant: Date): WeekRef {
  const today = parseYmd(kstYmd(instant));
  if (!today) throw new Error("날짜를 읽을 수 없다");
  return refFromMonday(new Date(today.getTime() - pyWeekday(today) * DAY));
}

/** 월요일 `YYYY-MM-DD` 가 아니면 null. */
export function weekRefFromStart(weekStart: string): WeekRef | null {
  const d = parseYmd(weekStart);
  if (!d || pyWeekday(d) !== 0) return null;
  return refFromMonday(d);
}

export function shiftWeek(weekStart: string, n: number): string {
  return addDays(weekStart, n * 7);
}

export function weeksBetween(fromStart: string, toStart: string): number {
  const a = parseYmd(fromStart);
  const b = parseYmd(toStart);
  if (!a || !b) throw new Error("잘못된 날짜");
  return Math.round((b.getTime() - a.getTime()) / DAY / 7);
}

export function weekWindows(weekStart: string): {
  thisWeek: YmdRange;
  nextWeek: YmdRange;
  startInstant: Date;
  endInstant: Date;
} {
  const d = parseYmd(weekStart);
  if (!d) throw new Error(`잘못된 날짜: ${weekStart}`);
  const startInstant = new Date(d.getTime() - KST_OFFSET_MS);
  const endInstant = new Date(startInstant.getTime() + 7 * DAY - 1);
  return {
    thisWeek: { startYmd: weekStart, endYmd: addDays(weekStart, 6) },
    nextWeek: nextWeekRange(startInstant),
    startInstant,
    endInstant,
  };
}

export function ymdInRange(ymd: string, r: YmdRange): boolean {
  return ymd >= r.startYmd && ymd <= r.endYmd;
}

/** now 를 그 주 `[start, end]` 안으로 자른다. */
export function referenceInstant(weekStart: string, now: Date): Date {
  const { startInstant, endInstant } = weekWindows(weekStart);
  if (now.getTime() < startInstant.getTime()) return startInstant;
  if (now.getTime() > endInstant.getTime()) return endInstant;
  return now;
}

/** 이번 주, 그리고 이번 주가 보고됐을 때만 다음 주를 새로 만든다. */
export function canCreateWeek(
  weekStart: string,
  now: Date,
  currentReported: boolean,
): boolean {
  const current = weekOf(now).weekStart;
  if (weekStart === current) return true;
  return currentReported && weekStart === shiftWeek(current, 1);
}

export function defaultWeekStart(now: Date, currentReported: boolean): string {
  const current = weekOf(now).weekStart;
  return currentReported ? shiftWeek(current, 1) : current;
}
