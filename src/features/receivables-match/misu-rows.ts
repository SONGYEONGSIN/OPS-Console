import type { ReceivablesSheet } from "@/features/receivables/queries";
import type { MisuRow } from "./types";

function findCol(headers: string[], re: RegExp): number {
  return headers.findIndex((h) => re.test(h));
}

function toNumber(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const n = Number(raw.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * 미수채권 ReceivablesSheet → MisuRow[] 변환.
 * 시트 헤더 row 다음(headerRowNumber+1)부터 데이터 — Excel 1-based row 계산.
 */
export function toMisuRows(sheet: ReceivablesSheet): MisuRow[] {
  const dateCol = findCol(sheet.headers, /^청구\s*일자/);
  const custCol = findCol(sheet.headers, /거래처명?|학교명?/);
  const amountCol = findCol(sheet.headers, /청구\s*금액|금액/);
  const noteCol = findCol(sheet.headers, /^적요$|비고/);
  if (dateCol < 0 || custCol < 0 || amountCol < 0) return [];

  const out: MisuRow[] = [];
  for (let i = 0; i < sheet.rowsText.length; i++) {
    const text = sheet.rowsText[i] ?? [];
    const values = sheet.rows[i] ?? [];
    const rowNumber = sheet.headerRowNumber + 1 + i;
    out.push({
      rowNumber,
      date: String(text[dateCol] ?? "").trim(),
      customer: String(text[custCol] ?? "").trim(),
      amount: toNumber(values[amountCol] ?? text[amountCol]),
      note: noteCol >= 0 ? String(text[noteCol] ?? "").trim() : "",
    });
  }
  return out;
}
