import type { Holiday } from "@/lib/holidays/google-ical";

/**
 * 미수 독려 메일 발송 대상 경과일수 (원본 Google Apps Script 그대로 이식).
 * 경과일수가 이 집합에 "정확히" 일치할 때만 발송 — 5일 간격 마일스톤, 100일 초과 중단.
 *
 * 운영자용: 35·45 누락 / 학교담당자용: 45만 누락 — 원본 GAS의 배열을 그대로 보존.
 * (의도/오타 여부는 추후 별도 확인. 충실 이식 우선.)
 */
export const OPERATOR_TARGET_DAYS: readonly number[] = [
  10, 15, 20, 25, 30, 40, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100,
];

export const SCHOOL_TARGET_DAYS: readonly number[] = [
  10, 15, 20, 25, 30, 35, 40, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100,
];

const KST = "Asia/Seoul";

const KST_WEEKDAY = new Intl.DateTimeFormat("en-US", {
  timeZone: KST,
  weekday: "short",
});

const KST_YMD = new Intl.DateTimeFormat("en-CA", {
  timeZone: KST,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * 발송 가능일인지 — KST 기준 주말(토·일) 또는 한국 공휴일이면 false.
 * 원본 GAS canRunToday_ 등가. (마일스톤이 주말·공휴일에 걸리면 그날은 건너뜀 — 보정 없음)
 *
 * @param now 기준 시각
 * @param holidays fetchKoreanHolidays() 결과 (date='YYYY-MM-DD')
 */
export function canSendOn(now: Date, holidays: Holiday[]): boolean {
  const wd = KST_WEEKDAY.format(now);
  if (wd === "Sat" || wd === "Sun") return false;
  const ymd = KST_YMD.format(now);
  if (holidays.some((h) => h.date === ymd)) return false;
  return true;
}
