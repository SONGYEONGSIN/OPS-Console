import "server-only";
import { readLedger } from "./ledger";
import { signReceiptUrls } from "./queries";
import { expectedSheetName } from "./ledger-parse";
import type { LedgerView } from "./ledger-view";

/**
 * 대장을 화면 모양으로 읽어 온다.
 *
 * **실패해도 던지지 않는다.** 대장은 Graph 너머에 있어 토큰 만료·시트 이름 변경으로
 * 못 읽을 수 있는데, 그때 페이지가 통째로 죽으면 업로드도 못 한다. 이유를 실어
 * 화면에 드러내고 나머지는 그대로 쓰게 한다.
 */

const KST_YEAR = () =>
  Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
    }).format(new Date()),
  );

export const EMPTY_LEDGER: LedgerView = {
  sheetName: "",
  years: [],
  year: 0,
  rows: [],
  receiptUrls: {},
  error: null,
};

export async function loadLedgerView(requested?: number): Promise<LedgerView> {
  // 고른 연도가 없으면 올해. 시트가 없는 연도를 고르면 읽기가 던져 이유가 뜬다.
  const year = requested && requested > 2000 ? requested : KST_YEAR();
  try {
    const ledger = await readLedger(year);
    const ids = [
      ...new Set(ledger.rows.map((r) => r.receiptId).filter(Boolean)),
    ] as string[];
    return {
      sheetName: ledger.sheetName,
      years: ledger.years,
      year,
      rows: ledger.rows,
      receiptUrls: await signReceiptUrls(ids),
      error: null,
    };
  } catch (e) {
    return {
      ...EMPTY_LEDGER,
      sheetName: expectedSheetName(year),
      year,
      error: `대장을 읽지 못했습니다 — ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
