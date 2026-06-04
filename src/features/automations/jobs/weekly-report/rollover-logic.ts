/**
 * 주간 업무보고서 차주 롤오버 — 순수 로직 (docs/buseobogo.py 이식).
 * 날짜/주차 계산, 파일명·시트명 롤오버, 발송자 순환, 셀 값 치환.
 * Graph I/O 없음 — 전부 결정적이라 단위 테스트로 검증.
 */

/** Python `datetime.weekday()` (월=0..일=6). JS getDay()는 일=0..토=6. */
export function pyWeekday(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

/** Python `%` (음수도 floor 방향). JS `%`는 부호가 피제수를 따라 다름. */
export function floorMod(a: number, b: number): number {
  return ((a % b) % b + b) % b;
}

/** UTC 기준 날짜 생성(타임존 영향 제거). */
function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}
const DAY = 86_400_000;

/** 해당 월의 ISO 8601 주차 수 — 목요일이 속한 월을 기준(월요일 시작). */
export function isoMonthWeeksCount(year: number, month: number): number {
  const firstDay = utc(year, month, 1);
  const daysToThu = floorMod(3 - pyWeekday(firstDay), 7);
  const firstThu = new Date(firstDay.getTime() + daysToThu * DAY);
  // 말일 = 다음 달 1일 - 1일
  const lastDay = new Date(utc(year, month + 1, 1).getTime() - DAY);
  const daysFromThu = floorMod(pyWeekday(lastDay) - 3, 7);
  const lastThu = new Date(lastDay.getTime() - daysFromThu * DAY);
  return Math.floor((lastThu.getTime() - firstThu.getTime()) / DAY / 7) + 1;
}

/** 주차+1, 해당 월 주차 수 초과 시 월/년 캐리. */
function rollWeek(
  year: number,
  month: number,
  week: number,
): { year: number; month: number; week: number } {
  let nextWeek = week + 1;
  let m = month;
  let y = year;
  const maxWeeks = isoMonthWeeksCount(y, m);
  if (nextWeek > maxWeeks) {
    nextWeek = 1;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return { year: y, month: m, week: nextWeek };
}

const FILENAME_RE =
  /^(주간업무보고서_진학어플라이본부)_(\d{4})_(\d+)월(\d+)주차(\.xlsx)$/;

/** 차주 파일명 — zero-pad 없음. 패턴 불일치 시 null. */
export function nextWeekFilename(filename: string): string | null {
  const m = FILENAME_RE.exec(filename);
  if (!m) return null;
  const [, prefix, yr, mo, wk, ext] = m;
  const r = rollWeek(Number(yr), Number(mo), Number(wk));
  return `${prefix}_${r.year}_${r.month}월${r.week}주차${ext}`;
}

const SHEETNAME_RE = /(\d{4})년\s*(\d+)월\s*(\d+)주차/;

/** 차주 시트명 — "YYYY년 M월 N주차". */
export function nextWeekSheetname(sheetname: string): string {
  const m = SHEETNAME_RE.exec(sheetname);
  if (!m) return sheetname;
  const r = rollWeek(Number(m[1]), Number(m[2]), Number(m[3]));
  return `${r.year}년 ${r.month}월 ${r.week}주차`;
}

/** 주차의 월~금 날짜 — 목요일 기준(목-3=월, 목+1=금). */
export function weekDateRange(
  year: number,
  month: number,
  week: number,
): { monday: Date; friday: Date } {
  const firstDay = utc(year, month, 1);
  const daysToThu = floorMod(3 - pyWeekday(firstDay), 7);
  const firstThu = new Date(firstDay.getTime() + daysToThu * DAY);
  const targetThu = new Date(firstThu.getTime() + (week - 1) * 7 * DAY);
  return {
    monday: new Date(targetThu.getTime() - 3 * DAY),
    friday: new Date(targetThu.getTime() + 1 * DAY),
  };
}

/** "M/D~M/D" (zero-pad 없음). */
export function formatDateRange(start: Date, end: Date): string {
  const f = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  return `${f(start)}~${f(end)}`;
}

export const WEEKLY_SENDERS = [
  "임형섭 부장님",
  "전성대 부장님",
  "허승철 부장님",
] as const;

const ANCHOR_YEAR = 2026; // 누적 주차 기준 시작연도 (2026-01 5주차 = 임형섭[0])
const ANCHOR_OFFSET = 2; // floorMod(2 + 누적주차, 3) 이 앵커에서 0이 되도록

/**
 * 발송자 순환 — 앵커(2026-01)부터 누적 ISO 주차로 3명 순환.
 * 원본은 2026 고정이었으나, 연도 경계를 넘어도 연속성이 유지되도록 일반화.
 */
export function senderForWeek(
  year: number,
  month: number,
  week: number,
): string {
  let total = 0;
  for (let y = ANCHOR_YEAR; y <= year; y++) {
    const lastMonth = y === year ? month - 1 : 12;
    for (let m = 1; m <= lastMonth; m++) total += isoMonthWeeksCount(y, m);
  }
  total += week - 1;
  const idx = floorMod(ANCHOR_OFFSET + total, WEEKLY_SENDERS.length);
  return WEEKLY_SENDERS[idx];
}

/** B2: "YYYY년 M월 N주차" 패턴을 새 시트명으로 치환(전체 교체 아님). */
export function subWeekText(cellValue: string, newSheetname: string): string {
  return cellValue.replace(/\d{4}년\s*\d+월\s*\d+주차/, newSheetname);
}

/** B3/H3: "M/D~M/D" 날짜 범위 치환. 패턴 없으면 원본 유지. */
export function subDateRange(cellValue: string, newRange: string): string {
  return cellValue.replace(/\d+\/\d+~\d+\/\d+/, newRange);
}
