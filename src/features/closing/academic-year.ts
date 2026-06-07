/**
 * 학년도 범위 — 작성마감 스크래핑 검색 기간 단일 소스 (KST 기준 동적 산출).
 *
 * SmileEDI fiscal-year.ts(회계연도 4/01)와 다른 경계를 쓴다:
 *   start = {startYear}-03-01 00:01, end = {startYear+1}-02-{말일} 23:59 (KST).
 * startYear: KST 월이 3 이상이면 올해, 1~2월이면 작년 → 매년 자동 +1.
 * 익년 2월 말일(28/29)은 윤년에 따라 동적 산출.
 *
 * Python 스크래퍼(Phase 2)는 동일 규칙을 재구현하며 본 util의 테스트 케이스 표로 동치를 보장한다.
 * 반환은 구조화(date/time 분리) — Moa 폼 입력 포맷 변환은 스크래퍼가 담당.
 */

const KST_YM = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
});

export type AcademicYearBound = { date: string; time: string };
export type AcademicYearRange = {
  start: AcademicYearBound;
  end: AcademicYearBound;
};

/** 2월 말일 (28 또는 윤년 29). year는 익년(2월이 속한 해). */
function februaryLastDay(year: number): number {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return isLeap ? 29 : 28;
}

export function academicYearRangeKST(now: Date): AcademicYearRange {
  // en-CA → 'YYYY-MM' (KST). 월만 사용.
  const [yearStr, monthStr] = KST_YM.format(now).split("-");
  const kstYear = Number(yearStr);
  const kstMonth = Number(monthStr); // 1~12

  const startYear = kstMonth >= 3 ? kstYear : kstYear - 1;
  const endYear = startYear + 1;
  const endDay = februaryLastDay(endYear);

  return {
    start: { date: `${startYear}-03-01`, time: "00:01" },
    end: { date: `${endYear}-02-${String(endDay).padStart(2, "0")}`, time: "23:59" },
  };
}
