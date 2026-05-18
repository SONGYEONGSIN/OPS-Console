/**
 * Gantt 차트 timeline 계산 helpers.
 * 일(day) 단위, KST 기준 (입력 ymd는 YYYY-MM-DD format).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function ymdToUtcNoon(ymd: string): Date {
  return new Date(`${ymd}T12:00:00Z`);
}

function ymdDiffDays(fromYmd: string, toYmd: string): number {
  const from = ymdToUtcNoon(fromYmd);
  const to = ymdToUtcNoon(toYmd);
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

const YMD_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

type GanttItem = { startYmd: string | null; endYmd: string | null };

export type GanttRange = { fromYmd: string; toYmd: string } | null;

export function computeGanttRange(items: GanttItem[]): GanttRange {
  let from: string | null = null;
  let to: string | null = null;
  for (const i of items) {
    if (i.startYmd && (from === null || i.startYmd < from)) from = i.startYmd;
    if (i.endYmd && (to === null || i.endYmd > to)) to = i.endYmd;
  }
  if (!from || !to) return null;
  return { fromYmd: from, toYmd: to };
}

export function enumerateDays(fromYmd: string, toYmd: string): string[] {
  const result: string[] = [];
  const total = ymdDiffDays(fromYmd, toYmd) + 1;
  const start = ymdToUtcNoon(fromYmd);
  for (let i = 0; i < total; i++) {
    const d = new Date(start.getTime() + i * MS_PER_DAY);
    result.push(YMD_FMT.format(d));
  }
  return result;
}

type BarPositionInput = {
  startYmd: string | null;
  endYmd: string | null;
  fromYmd: string;
  toYmd: string;
};

export type BarPosition = { leftPct: number; widthPct: number };

export function computeBarPosition(input: BarPositionInput): BarPosition {
  const { startYmd, endYmd, fromYmd, toYmd } = input;
  if (!startYmd || !endYmd) return { leftPct: 0, widthPct: 0 };

  // bar가 range 밖이면 0
  if (endYmd < fromYmd || startYmd > toYmd) return { leftPct: 0, widthPct: 0 };

  const totalDays = ymdDiffDays(fromYmd, toYmd) + 1;
  if (totalDays <= 0) return { leftPct: 0, widthPct: 0 };

  // clamp
  const clampedStart = startYmd < fromYmd ? fromYmd : startYmd;
  const clampedEnd = endYmd > toYmd ? toYmd : endYmd;

  const offsetDays = ymdDiffDays(fromYmd, clampedStart);
  const spanDays = ymdDiffDays(clampedStart, clampedEnd) + 1;

  return {
    leftPct: (offsetDays / totalDays) * 100,
    widthPct: (spanDays / totalDays) * 100,
  };
}
