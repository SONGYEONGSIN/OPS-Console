/**
 * 한국 영업일(주말·공휴일 제외) 판정 — KST 기준.
 *
 * KR_HOLIDAYS는 **매년 갱신이 필요한 상수**다. 음력/대체공휴일은 해마다 날짜가
 * 바뀌므로, 연초에 정부 지정 공휴일로 검증·보정할 것. (주말은 isKstWeekend가 처리)
 */

const KST_WEEKDAY = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  weekday: "short",
});

const KST_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 한국 법정공휴일 + 대체공휴일 (2026–2027). 평일에 해당하는 날짜 위주, 주말 중복 무해. */
export const KR_HOLIDAYS: ReadonlySet<string> = new Set([
  // 2026
  "2026-01-01", // 신정
  "2026-02-16",
  "2026-02-17",
  "2026-02-18", // 설날 연휴
  "2026-03-01",
  "2026-03-02", // 삼일절 + 대체
  "2026-05-05", // 어린이날
  "2026-05-24",
  "2026-05-25", // 부처님오신날 + 대체
  "2026-06-06", // 현충일
  "2026-08-15", // 광복절
  "2026-09-24",
  "2026-09-25",
  "2026-09-26",
  "2026-09-28", // 추석 연휴 + 대체
  "2026-10-03",
  "2026-10-05", // 개천절 + 대체
  "2026-10-09", // 한글날
  "2026-12-25", // 성탄절
  // 2027
  "2027-01-01",
  "2027-02-06",
  "2027-02-07",
  "2027-02-08",
  "2027-02-09", // 설날 연휴 + 대체
  "2027-03-01", // 삼일절
  "2027-05-05", // 어린이날
  "2027-05-13", // 부처님오신날
  "2027-06-06",
  "2027-06-07", // 현충일 + 대체
  "2027-08-15",
  "2027-08-16", // 광복절 + 대체
  "2027-09-14",
  "2027-09-15",
  "2027-09-16", // 추석 연휴
  "2027-10-03",
  "2027-10-04", // 개천절 + 대체
  "2027-10-09",
  "2027-10-11", // 한글날 + 대체
  "2027-12-25", // 성탄절
]);

/** KST 기준 토/일 여부. */
export function isKstWeekend(date: Date): boolean {
  const wd = KST_WEEKDAY.format(date);
  return wd === "Sat" || wd === "Sun";
}

/** KST 기준 영업일(주말·공휴일 아님) 여부. */
export function isKstBusinessDay(date: Date): boolean {
  if (isKstWeekend(date)) return false;
  return !KR_HOLIDAYS.has(KST_DATE.format(date));
}
