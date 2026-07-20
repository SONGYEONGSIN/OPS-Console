import type { MisuRow, DepositRow } from "./types";
import { normalizeName } from "./normalize";
import { isNameMatchStrong } from "./similarity";

/** ISO yyyy-MM-dd 문자열 + 1일. 입력이 빈 문자열이면 그대로 반환. */
function addOneDay(iso: string): string {
  if (!iso) return iso;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** depDate >= billDate + 1일 (GAS isDateMatch_) — yyyy-MM-dd lexicographic 비교. */
function isDateMatch(billDate: string, depDate: string): boolean {
  if (!billDate || !depDate) return false;
  return depDate >= addOneDay(billDate);
}

/**
 * GAS `collectUnpaidMisuByCustomer_` 1:1 — 거래처별 미수 미처리 청구 수집.
 * - 적요가 "입금완료"가 아닌 행 (빈칸 + 자유 메모 포함 — isUnpaidMisu와 동일 기준)
 * - 청구일 ≤ limitDate
 * - 거래처명 정규화 후 정확 일치
 */
export function collectUnpaidMisuByCustomer(
  rows: MisuRow[],
  custName: string,
  limitDate: string,
): MisuRow[] {
  const target = normalizeName(custName);
  const out: MisuRow[] = [];
  for (const row of rows) {
    if (!row.date || !row.customer || !row.amount) continue;
    if ((row.note ?? "").trim() === "입금완료") continue;
    if (row.date > limitDate) continue;
    if (normalizeName(row.customer) === target) {
      out.push(row);
    }
  }
  return out;
}

/**
 * GAS `collectUnpaidDepositsByCustomer_` 1:1 — 거래처별 입금 미처리 수집.
 * - matchedDepRows에 이미 있는 행 제외
 * - 미결제표시 != "처리완료"
 * - 거래내용 강매칭 통과
 * - billDate 지정 시 depDate >= billDate + 1일
 */
export function collectUnpaidDepositsByCustomer(
  deposits: DepositRow[],
  custName: string,
  billDate: string,
  matchedDepRows: Set<number>,
): DepositRow[] {
  const out: DepositRow[] = [];
  for (const dep of deposits) {
    if (matchedDepRows.has(dep.row)) continue;
    if (!dep.amount || dep.amount === 0) continue;
    if (dep.matchedFlag && dep.matchedFlag.trim() === "처리완료") continue;
    if (!isNameMatchStrong(custName, dep.content)) continue;
    if (billDate && !isDateMatch(billDate, dep.date)) continue;
    out.push(dep);
  }
  return out;
}
