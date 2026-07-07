/**
 * 미수채권 시트의 '청구금액' 컬럼 합산 (순수함수).
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

  let total = 0;
  for (let i = 0; i < rows.length; i++) {
    const n =
      toNumber(rows[i]?.[amountCol]) ?? toNumber(rowsText[i]?.[amountCol]);
    if (n !== null && n > 0) total += n;
  }
  return total;
}
