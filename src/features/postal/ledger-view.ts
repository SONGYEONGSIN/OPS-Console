import type { LedgerLine } from "./ledger";

/**
 * 화면에 넘기는 대장 묶음.
 *
 * 읽기가 실패해도 화면은 떠야 한다 — 빈 표를 그리면 "발송이 없다"로 읽히므로
 * 이유를 함께 실어 보낸다. 서버 전용 타입(`ledger.ts`)과 갈라 둔 이유는
 * client component가 import하기 때문이다.
 */
export type LedgerView = {
  sheetName: string;
  /** 고를 수 있는 연도(최신순)와 지금 보고 있는 연도. */
  years: number[];
  year: number;
  rows: LedgerLine[];
  /** 영수증 id → 서명 URL. 만료된 것은 아예 없다. */
  receiptUrls: Record<string, string>;
  /** 못 읽었으면 그 이유. 없으면 null. */
  error: string | null;
};
