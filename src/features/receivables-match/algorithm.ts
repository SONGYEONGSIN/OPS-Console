import type {
  MisuRow,
  DepositRow,
  MatchPair,
  MismatchPair,
  MatchResult,
} from "./types";
import {
  collectUnpaidMisuByCustomer,
  collectUnpaidDepositsByCustomer,
} from "./collect";
import { isNameMatchStrong, similarity } from "./similarity";
import { normalizeName, baseName } from "./normalize";

/** isDateMatch: depDate >= billDate + 1일 */
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
function isDateMatch(billDate: string, depDate: string): boolean {
  if (!billDate || !depDate) return false;
  return depDate >= addOneDay(billDate);
}

function sumAmounts<T extends { amount: number }>(list: T[]): number {
  return list.reduce((s, o) => s + o.amount, 0);
}

function latestDate(rows: { date: string }[]): string {
  return rows.reduce(
    (latest, r) => (r.date > latest ? r.date : latest),
    rows[0]?.date ?? "",
  );
}

// mismatch(금액 일치·이름 불일치) 확인 요청 최소 유사도.
// 금액만 우연히 같고 거래처가 명백히 다른 건(예: 명지대↔충북대국제교류 0.29, 가천대↔동국대 0.33)을
// 제외하고, 별칭 후보일 만큼 유사한 건(예: 서강대↔서강국제대학원 0.57, 한국외대 0.50)만
// admin 확인 요청한다. (보정: 명백히 다름 ≤ 0.33 / 실제 별칭 ≥ 0.50 — 그 사이 0.4로 컷)
const MISMATCH_MIN_SIMILARITY = 0.4;

function isUnpaidMisu(m: MisuRow): boolean {
  return !m.note || m.note.trim() === "";
}
function isUnpaidDeposit(d: DepositRow): boolean {
  return !d.matchedFlag || d.matchedFlag.trim() !== "처리완료";
}

/**
 * GAS `autoMatchDeposits` 메인 루프 1:1 포팅 — pure function.
 *
 * 3단계 우선순위 디스패처:
 * 1. 단건 1:1 — 금액 동일 + 이름 강매칭 + isDateMatch
 * 2. N:1 합산 — 거래처별 미수 N건 합 = 입금 1건
 * 3. N:M 합산 — 거래처별 미수 N건 합 = 입금 M건 합
 * 4. mismatch detect — 금액 동일 but 이름 불일치 (admin 알림용)
 *
 * matchedMisuRows / matchedDepRows Set으로 중복 매칭 방지.
 */
export function runMatch(
  misu: MisuRow[],
  deposits: DepositRow[],
  extraAliases: Record<string, string> = {},
): MatchResult {
  const matched: MatchPair[] = [];
  const mismatches: MismatchPair[] = [];
  const matchedMisuRows = new Set<number>();
  const matchedDepRows = new Set<number>();

  // 1+2: 미수 행 loop — 단건 1:1 또는 N:1 합산
  for (const m of misu) {
    if (matchedMisuRows.has(m.rowNumber)) continue;
    if (!isUnpaidMisu(m)) continue;
    if (!m.date || !m.customer || !m.amount) continue;

    for (const d of deposits) {
      if (matchedDepRows.has(d.row)) continue;
      if (!isUnpaidDeposit(d)) continue;
      if (!d.amount) continue;
      if (!isDateMatch(m.date, d.date)) continue;
      if (!isNameMatchStrong(m.customer, d.content, extraAliases)) continue;

      // 단건 1:1
      if (m.amount === d.amount) {
        matched.push({
          misuRows: [m.rowNumber],
          depRows: [d.row],
          kind: "oneToOne",
          depositDate: d.date,
          amount: d.amount,
        });
        matchedMisuRows.add(m.rowNumber);
        matchedDepRows.add(d.row);
        break;
      }

      // N:1 합산 — 거래처별 미수 (미매칭/미처리)에서 d.date 기준 limitDate로 모음
      const grouped = collectUnpaidMisuByCustomer(
        misu.filter((x) => !matchedMisuRows.has(x.rowNumber)),
        m.customer,
        d.date,
      );
      if (grouped.length >= 2 && sumAmounts(grouped) === d.amount) {
        matched.push({
          misuRows: grouped.map((g) => g.rowNumber),
          depRows: [d.row],
          kind: "nToOne",
          depositDate: d.date,
          amount: d.amount,
        });
        grouped.forEach((g) => matchedMisuRows.add(g.rowNumber));
        matchedDepRows.add(d.row);
        break;
      }
    }
  }

  // 3: N:M 합산 — 거래처 단위 통째로 합계 일치
  const remainingMisu = misu.filter(
    (m) =>
      !matchedMisuRows.has(m.rowNumber) &&
      isUnpaidMisu(m) &&
      m.date &&
      m.customer &&
      m.amount,
  );
  const customerMap = new Map<string, MisuRow[]>();
  for (const m of remainingMisu) {
    const key = normalizeName(m.customer, extraAliases);
    const list = customerMap.get(key) ?? [];
    list.push(m);
    customerMap.set(key, list);
  }
  for (const [, misuList] of customerMap) {
    if (misuList.length < 1) continue;
    const earliest = misuList.reduce(
      (e, m) => (m.date < e ? m.date : e),
      misuList[0].date,
    );
    const depList = collectUnpaidDepositsByCustomer(
      deposits,
      misuList[0].customer,
      earliest,
      matchedDepRows,
    );
    if (depList.length < 1) continue;
    if (misuList.length === 1 && depList.length === 1) continue; // 1:1은 메인 루프 책임
    const misuTotal = sumAmounts(misuList);
    const depTotal = sumAmounts(depList);
    if (misuTotal !== depTotal) continue;

    matched.push({
      misuRows: misuList.map((m) => m.rowNumber),
      depRows: depList.map((d) => d.row),
      kind: "nToM",
      depositDate: latestDate(depList),
      amount: misuTotal,
    });
    misuList.forEach((m) => matchedMisuRows.add(m.rowNumber));
    depList.forEach((d) => matchedDepRows.add(d.row));
  }

  // 3.5: 캠퍼스 통합 N:M — 캠퍼스 접미사로 분리된 미수를 base 대학명으로 묶어 합산 일치 시도.
  //   "을지대(성남)" + "을지대(의정부)" 처럼 캠퍼스가 다른 미수가 base 대학명 입금 1건과
  //   매칭되는 케이스. 기존 캠퍼스 구분 매칭(1·2·3단계) 이후의 잔여 미수에만 적용하므로
  //   단일 캠퍼스 N:1(예: 성남만 합산 입금)은 보존된다. 합계가 정확히 일치할 때만 매칭.
  const remainingForBase = misu.filter(
    (m) =>
      !matchedMisuRows.has(m.rowNumber) &&
      isUnpaidMisu(m) &&
      m.date &&
      m.customer &&
      m.amount,
  );
  const baseGroupMap = new Map<string, MisuRow[]>();
  for (const m of remainingForBase) {
    const key = baseName(m.customer, extraAliases);
    if (!key) continue;
    const list = baseGroupMap.get(key) ?? [];
    list.push(m);
    baseGroupMap.set(key, list);
  }
  for (const [gbase, misuList] of baseGroupMap) {
    if (misuList.length < 2) continue; // 단건은 1:1/N:1 책임
    const earliest = misuList.reduce(
      (e, m) => (m.date < e ? m.date : e),
      misuList[0].date,
    );
    const depList = collectUnpaidDepositsByCustomer(
      deposits,
      gbase,
      earliest,
      matchedDepRows,
    );
    if (depList.length < 1) continue;
    const misuTotal = sumAmounts(misuList);
    const depTotal = sumAmounts(depList);
    if (misuTotal !== depTotal) continue;

    matched.push({
      misuRows: misuList.map((m) => m.rowNumber),
      depRows: depList.map((d) => d.row),
      kind: "nToM",
      depositDate: latestDate(depList),
      amount: misuTotal,
    });
    misuList.forEach((m) => matchedMisuRows.add(m.rowNumber));
    depList.forEach((d) => matchedDepRows.add(d.row));
  }

  // 4: mismatch detect — 금액 동일 but 이름 불일치 (admin 알림)
  for (const m of misu) {
    if (matchedMisuRows.has(m.rowNumber)) continue;
    if (!isUnpaidMisu(m)) continue;
    if (!m.date || !m.customer || !m.amount) continue;
    for (const d of deposits) {
      if (matchedDepRows.has(d.row)) continue;
      if (!isUnpaidDeposit(d)) continue;
      if (!d.amount) continue;
      if (!isDateMatch(m.date, d.date)) continue;
      if (
        m.amount === d.amount &&
        !isNameMatchStrong(m.customer, d.content, extraAliases) &&
        similarity(m.customer, d.content) >= MISMATCH_MIN_SIMILARITY
      ) {
        mismatches.push({
          misuRow: m.rowNumber,
          depRow: d.row,
          amount: m.amount,
          misuCustomer: m.customer,
          depContent: d.content,
          misuDate: m.date,
          depDate: d.date,
        });
      }
    }
  }

  const unmatchedMisu = misu
    .filter((m) => !matchedMisuRows.has(m.rowNumber) && isUnpaidMisu(m))
    .map((m) => m.rowNumber);
  const unmatchedDep = deposits
    .filter(
      (d) => !matchedDepRows.has(d.row) && isUnpaidDeposit(d) && d.amount > 0,
    )
    .map((d) => d.row);

  return { matched, mismatches, unmatchedMisu, unmatchedDep };
}
