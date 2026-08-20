import { LEDGER_HEADERS } from "./ledger-parse";

/**
 * 확정한 등기를 대장 엑셀에 쓴다 — 3단계.
 *
 * 지금까지는 확정해도 `postal_items`(DB)와 전도금 장부에만 들어가고, **등기대장은
 * 손으로** 적었다. 읽기는 이미 되니(`ledger.ts`) 쓰기만 붙인다.
 *
 * 자리 찾기는 전도금과 같은 원리다 — 날짜순을 지켜야 하고, 아래를 밀어내야 할
 * 때가 있다. 다른 건 **순번**이다: 대장의 순번은 전체 일련번호가 아니라
 * **그날 몇 번째**를 센다(엑셀 실물이 그렇다 — 8/14 은 1~7, 8/18 은 1~3).
 */

/** 대장 열 개수. `순번·발송일·수신처·수신자·담당자·확인·등기번호·비고` */
export const LEDGER_COL_COUNT = LEDGER_HEADERS.length;

/** 발송일 칸(B열)의 0-based 인덱스. */
const DATE_COL = 1;
/** 순번 칸(A열). */
const SEQ_COL = 0;

export type LedgerInsertTarget = {
  /** 1-based 엑셀 행 번호. */
  row: number;
  /** 아래를 밀어내야 하는가. 맨 끝에 붙일 때는 밀 것이 없다. */
  shiftDown: boolean;
};

/**
 * 그날의 다음 순번.
 *
 * **날짜별로 다시 1부터다.** 전체 행 수를 세면 8/19 첫 건이 267번이 되는데,
 * 대장은 그렇게 안 적혀 있다.
 */
export function nextDaySeq(values: unknown[][], dateSerial: number): number {
  let max = 0;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i]?.[DATE_COL] !== dateSerial) continue;
    const seq = values[i]?.[SEQ_COL];
    if (typeof seq === "number" && seq > max) max = seq;
  }
  return max + 1;
}

/**
 * 날짜순을 지키는 자리.
 *
 * 같은 날이면 그날 마지막 뒤에 붙는다 — 먼저 적은 것이 위다.
 */
export function findLedgerInsertRow(
  values: unknown[][],
  dateSerial: number,
): LedgerInsertTarget {
  let lastFitting = 0;
  let firstDated = 0;
  for (let i = 1; i < values.length; i += 1) {
    const cell = values[i]?.[DATE_COL];
    if (typeof cell !== "number") continue;
    if (firstDated === 0) firstDated = i + 1;
    if (cell <= dateSerial) lastFitting = i + 1;
  }
  const row =
    lastFitting > 0 ? lastFitting + 1 : firstDated || values.length + 1;
  return { row, shiftDown: row <= values.length };
}

export type LedgerWriteRow = {
  trackingNo: string;
  recipientOrg: string | null;
  recipientName: string | null;
  assignee: string | null;
};

/**
 * 엑셀 열 순서 그대로 여러 줄.
 *
 * 한 영수증에 등기가 여러 건 찍히므로 **순번이 이어진다.** 담당자가 비어도 행은
 * 만든다 — 대장에 빈 칸으로 남는 게 사실이고, 숨기면 채워야 할 것을 놓친다.
 */
export function buildLedgerRows(
  rows: LedgerWriteRow[],
  meta: { dateSerial: number; startSeq: number; confirmedBy: string },
): (string | number)[][] {
  return rows.map((r, i) => [
    meta.startSeq + i,
    // 시트의 날짜 칸은 일련번호다. 문자열로 넣으면 그 행만 텍스트가 된다.
    meta.dateSerial,
    r.recipientOrg ?? "",
    r.recipientName ?? "",
    r.assignee ?? "",
    meta.confirmedBy,
    r.trackingNo,
    "", // 비고 — 사람이 나중에 적는다
  ]);
}
