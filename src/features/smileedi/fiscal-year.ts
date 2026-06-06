/**
 * SmileEDI 세금계산서 검색 기간 — 회계연도 4/01 ~ 익년 3/31, KST 기준 동적 산출.
 *
 * Tax_invoice.py의 하드코딩(SEARCH_START_DATE/END_DATE)을 제거하기 위한 단일 소스.
 * 규칙: KST 기준 월이 4월 이상이면 올해가 회계연도 시작, 1~3월이면 작년이 시작 →
 * 매년 자동으로 +1 된다. 반환은 SmileEDI 검색 폼이 쓰는 'YYYYMMDD' 문자열.
 */

const KST_YMD = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type FiscalYearRange = { startYmd: string; endYmd: string };

export function fiscalYearRangeKST(now: Date): FiscalYearRange {
  // en-CA → 'YYYY-MM-DD' (KST). 월만 사용.
  const [yearStr, monthStr] = KST_YMD.format(now).split("-");
  const kstYear = Number(yearStr);
  const kstMonth = Number(monthStr); // 1~12

  const startYear = kstMonth >= 4 ? kstYear : kstYear - 1;
  const endYear = startYear + 1;

  return {
    startYmd: `${startYear}0401`,
    endYmd: `${endYear}0331`,
  };
}
