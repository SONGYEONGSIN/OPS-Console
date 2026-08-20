import { isoToExcelSerial } from "@/lib/excel-date";
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
  /** 잔액은 비운다 — 수식으로 따로 쓴다(`balanceFormula`). */
  string,
  /** 날짜는 엑셀 일련번호. 시트의 기존 행이 그렇게 들어 있다. */
  number,
  string,
  number | string,
  number,
  string,
];

export function buildSpendRow(input: SpendInput): SheetRow {
  return [
    "", // 청구 행이 아니다
    "",
    // 잔액은 수식으로 따로 쓴다. 값으로 넣으면 그 행부터 자동 계산이 끊겨,
    // 나중에 금액을 고쳐도 잔액이 안 따라온다(시트는 `=$C73-$G74` 꼴이다).
    "",
    // 시트의 날짜 칸은 일련번호다. 문자열로 넣으면 그 행만 텍스트가 된다.
    isoToExcelSerial(input.date),
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

/**
 * 시트의 열 순서. 이 순서가 곧 의미라 어긋나면 엉뚱한 칸에 쓴다.
 * (`전도금內 · 청구금액 · 잔액 · 날짜 · 내용 · 건수 · 금액 · 품목`)
 */
export const PETTY_HEADERS = [
  "전도금內",
  "",
  "잔액",
  "날짜",
  "내용",
  "건수",
  "금액",
  "품목",
] as const;

/** 날짜 칸(D열)의 0-based 인덱스. */
const DATE_COL = 3;

export type InsertTarget = {
  /** 1-based 엑셀 행 번호. */
  row: number;
  /** 아래를 밀어내야 하는가. 맨 끝에 붙일 때는 밀 것이 없다. */
  shiftDown: boolean;
};

/**
 * 날짜순을 지키는 자리를 찾는다.
 *
 * 우편물은 날짜순으로 쌓이지만 사무용품을 뒤늦게 넣는 일이 있다(2026-08-20).
 * 날짜가 뒤섞이면 **잔액 수식이 가리키는 순서와 실제 시간 순서가 어긋난다** —
 * 잔액은 바로 윗줄에서 빼는 구조라 줄 순서가 곧 계산 순서다.
 *
 * **충전(`전도금청구`) 행을 넘어가지 않는다.** 넘어가면 충전 전에 쓴 돈이 충전 뒤
 * 구간에 들어가 구간별 사용 합계가 어긋난다. 실제 시트에서 충전은 2·42·56·73행에 있다.
 */
export function findInsertRow(
  values: unknown[][],
  dateSerial: number,
): InsertTarget {
  let lastFittingDated = 0; // 0 = 맞는 날짜 행이 아직 없음
  let firstDated = 0;
  for (let i = 1; i < values.length; i += 1) {
    const cell = values[i]?.[DATE_COL];
    // 충전 행은 날짜가 없어 비교 대상이 아니다.
    if (typeof cell !== "number") continue;
    if (firstDated === 0) firstDated = i + 1;
    // 같은 날이면 먼저 적은 것이 위다.
    if (cell <= dateSerial) lastFittingDated = i + 1;
  }

  // 가장 이른 날짜면 첫 사용 행 앞. 사용 행이 하나도 없으면 맨 끝.
  const row =
    lastFittingDated > 0
      ? lastFittingDated + 1
      : firstDated || values.length + 1;
  return { row, shiftDown: row <= values.length };
}

/**
 * 잔액 = 바로 윗줄 잔액 − 이번 금액.
 *
 * **값이 아니라 수식으로 쓴다.** 시트가 이미 그렇게 되어 있는데(`=$C73-$G74`) 값으로
 * 넣으면 그 행부터 자동 계산이 끊겨, 나중에 금액을 고쳐도 잔액이 안 따라온다.
 */
export function balanceFormula(row: number): string {
  if (row <= 2) {
    // 헤더 바로 아래에는 뺄 윗줄이 없다.
    throw new Error(`잔액 수식을 만들 수 없는 행입니다: ${row}`);
  }
  return `=$C${row - 1}-$G${row}`;
}
