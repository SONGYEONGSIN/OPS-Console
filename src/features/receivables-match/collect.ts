import type { MisuRow, DepositRow } from "./types";
import { normalizeName } from "./normalize";
import { isNameMatchStrong } from "./similarity";

function formatIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 표시 포맷이 섞인 날짜 문자열을 yyyy-MM-dd로 정규화.
 *
 * 미수 시트 청구일자는 "2026.7.3"(점), 입금 시트 거래일시는 "2026-07-13 11:48:04"(하이픈)로
 * 표시 포맷이 다르다. 원본끼리 비교하면 '.'(0x2E) > '-'(0x2D) 때문에 점 포맷이 항상
 * 미래로 판정된다 — 날짜 비교 전에 반드시 이 함수를 거친다.
 * 파싱 실패 시 원본 반환 (비교 불가한 값을 임의 날짜로 바꾸지 않는다).
 */
function toIsoDate(raw: string): string {
  if (!raw) return raw;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return formatIso(d);
}

/** ISO yyyy-MM-dd 문자열 + 1일. 입력이 빈 문자열이면 그대로 반환. */
function addOneDay(iso: string): string {
  if (!iso) return iso;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + 1);
  return formatIso(d);
}

/** depDate >= billDate + 1일 (GAS isDateMatch_) — yyyy-MM-dd lexicographic 비교. */
function isDateMatch(billDate: string, depDate: string): boolean {
  if (!billDate || !depDate) return false;
  return depDate >= addOneDay(billDate);
}

/**
 * GAS `collectUnpaidMisuByCustomer_` 1:1 — 거래처별 미수 미처리 청구 수집.
 * - 적요가 "입금완료"가 아닌 행 (빈칸 + 자유 메모 포함 — isUnpaidMisu와 동일 기준)
 * - 청구일 ≤ limitDate (표시 포맷이 달라도 되도록 양쪽 ISO 정규화 후 비교)
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
    if (toIsoDate(row.date) > toIsoDate(limitDate)) continue;
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
