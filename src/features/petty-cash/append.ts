import type { PettyCashEntry } from "./parse";

/**
 * 전도금 장부에 사용 한 줄을 붙이기 위한 계산.
 *
 * **엑셀 쓰기는 되돌리기 어렵다.** 순수 함수로 떼어 테스트로 고정하고, 실제 PATCH는
 * actions에서 이 결과를 그대로 쓴다.
 */

export type SpendInput = {
  /** YYYY-MM-DD */
  date: string;
  /** '우편물' 등 */
  title: string;
  count: number | null;
  amount: number;
  item?: string | null;
};

/** 시트 한 줄 — [전도금內, 청구전, 잔액, 날짜, 내용, 건수, 금액, 품목] */
export type SheetRow = [
  string,
  string,
  number,
  string,
  string,
  number | string,
  number,
  string,
];

export function buildSpendRow(
  input: SpendInput,
  balanceBefore: number,
): SheetRow {
  return [
    "", // 청구 행이 아니다
    "",
    // 잔액이 모자라도 그대로 적는다 — 숨기면 채워야 할 때를 놓친다.
    balanceBefore - input.amount,
    input.date,
    input.title,
    input.count ?? "",
    input.amount,
    input.item ?? "",
  ];
}

/** 쓰인 마지막 행 다음 줄. 1행은 헤더라 최소 2행부터. */
export function nextRowAddress(usedRowCount: number): string {
  const row = Math.max(2, usedRowCount + 1);
  return `A${row}:H${row}`;
}

/**
 * 같은 건이 이미 장부에 있는가.
 *
 * 같은 영수증을 두 번 확정하면 두 줄이 남고 잔액이 실제와 어긋난다. Graph 쓰기는
 * 반영에 1~2분 걸려(기록: graph-workbook-session-persist-delay) 직후 재조회로도
 * 못 잡으니, **쓰기 전에** 본다.
 */
export function findDuplicate(
  entries: PettyCashEntry[],
  input: { date: string; title: string; count: number | null; amount: number },
): boolean {
  return entries.some(
    (e) =>
      e.kind === "spend" &&
      e.date === input.date &&
      e.amount === input.amount &&
      e.count === input.count,
  );
}
