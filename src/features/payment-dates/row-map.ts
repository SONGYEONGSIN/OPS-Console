import type { PaymentDate } from "./schemas";

/**
 * `NN기비용지급일` 시트의 usedRange text 행들을 PaymentDate[]로 변환.
 *
 * 각 행: [연도, 월, 일, 개인/공용]. text 값이라 한글 접미사 포함("2026년"/"4월"/"9일") →
 * 숫자만 추출한다. 헤더행("연도"→숫자 없음)·빈 행·범위 밖 값·category 공란은 skip.
 */
function digits(cell: unknown): number | null {
  const s = String(cell ?? "").replace(/[^\d]/g, "");
  if (s === "") return null;
  return Number(s);
}

export function mapPaymentRows(
  rows: unknown[][],
  sheetName: string,
): PaymentDate[] {
  const out: PaymentDate[] = [];
  for (const row of rows) {
    const year = digits(row[0]);
    const month = digits(row[1]);
    const day = digits(row[2]);
    const category = String(row[3] ?? "").trim();

    if (year === null || month === null || day === null) continue;
    if (year < 1000 || year > 9999) continue;
    if (month < 1 || month > 12) continue;
    if (day < 1 || day > 31) continue;
    if (category === "") continue;

    const ymd = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    out.push({ ymd, year, month, day, category, sheetName });
  }
  return out;
}
