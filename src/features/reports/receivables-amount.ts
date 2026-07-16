import { isPaidReceivableRow } from "@/features/receivables/paid-row";
import { isReceivablesDataCells } from "@/features/receivables/sheet-row";

/**
 * 미수채권 시트의 '청구금액' 컬럼 합산 (순수함수) — 미수(미입금) 행만 대상.
 * values(rows)를 우선 파싱, 비어있으면 rowsText로 폴백. 음수/비숫자/빈값은 제외.
 * 금액 컬럼 미검출 시 0.
 */
function toNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string") {
    const cleaned = raw.replace(/,/g, "").trim();
    if (cleaned === "") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function sumAmountColumn(
  headers: string[],
  rows: unknown[][],
  rowsText: string[][],
): number {
  const amountCol = headers.findIndex((h) => /청구\s*금액|금액/.test(h));
  if (amountCol === -1) return 0;

  // 미수 행만 합산 — 미수채권 메뉴와 동일 기준: ①합계/소계·청구일자 빈 행 제외
  // (isReceivablesDataCells) ②입금완료(수금) 행 제외(isPaidReceivableRow).
  // 컬럼 regex는 pickReceivablesColumns와 동일.
  const dateCol = headers.findIndex((h) => /^청구일자|^청구\s*일자/.test(h));
  const statusCol = headers.findIndex((h) => /입금여부|여부|상태/.test(h));
  const remarksCol = headers.findIndex((h) => /적요|비고|메모|피드백/.test(h));
  const cellText = (i: number, ci: number): string =>
    ci >= 0 ? (rowsText[i]?.[ci] ?? String(rows[i]?.[ci] ?? "")) : "";
  const rowCells = (i: number): string[] => {
    const t = rowsText[i];
    if (t && t.length > 0) return t;
    return (rows[i] ?? []).map((v) => String(v ?? ""));
  };

  let total = 0;
  for (let i = 0; i < rows.length; i++) {
    if (!isReceivablesDataCells(rowCells(i), cellText(i, dateCol))) continue;
    if (isPaidReceivableRow(cellText(i, statusCol), cellText(i, remarksCol)))
      continue;
    const n =
      toNumber(rows[i]?.[amountCol]) ?? toNumber(rowsText[i]?.[amountCol]);
    if (n !== null && n > 0) total += n;
  }
  return total;
}
