import { excelSerialToIso } from "@/lib/excel-date";
/**
 * 전도금 시트 파싱 — `08. 비용관리 > 전도금 > 2026년도 전도금 비용.xlsx`.
 *
 * 잔액 장부다. 두 종류의 행이 섞여 있다:
 * - **청구**: `전도금청구 | 쓰고남은돈 | 500,000` — 채워서 다시 50만원이 된다
 * - **사용**: `| 잔액 | 날짜 | 내용 | 건수 | 금액 | 품목`
 *
 * 금액 표기가 섞여 있다(` 3,920 ` / `13290`) — 손으로 적은 것과 붙여넣은 것이
 * 뒤섞여 그렇다. 둘 다 읽는다.
 */

/** 시트 열 위치. 바뀌면 여기만 고친다. */
const COL = {
  refillLabel: 0,
  refillBefore: 1,
  balance: 2,
  date: 3,
  title: 4,
  count: 5,
  amount: 6,
  item: 7,
} as const;

export type PettyCashEntry =
  | {
      kind: "refill";
      /** 채우기 직전 잔액 */
      before: number | null;
      /** 채운 뒤 잔액(보통 500,000) */
      balance: number | null;
    }
  | {
      kind: "spend";
      date: string;
      title: string;
      count: number | null;
      amount: number | null;
      item: string | null;
      /** 이 건을 쓰고 남은 잔액 */
      balance: number | null;
    };

export type PettyCashSheet = {
  entries: PettyCashEntry[];
  /** 지금 잔액 — 장부라 맨 아래가 현재다. */
  balance: number | null;
  /** 사용 행 합계 */
  totalSpent: number;
  /**
   * 현재 잔액을 읽은 칸 — 맨 아래 항목의 시트 행 번호(헤더가 1행)와 C열 원문.
   * 못 읽었을 때 어디를 고칠지 말하려고 둔다. 항목이 없으면 null.
   */
  balanceCell: { row: number; text: string } | null;
};

/** ` 496,080 ` · `13290` 둘 다 읽는다. 숫자가 아니면 null(0으로 세지 않는다). */
export function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[,\s]/g, "");
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned));
}

/**
 * 날짜 칸이 엑셀 일련번호로 오는 경우를 되돌린다.
 *
 * 우편물 확정이 장부에 쓸 때 일련번호로 넣는다 — 날짜 서식 칸에 문자열을 넣으면
 * 어긋나기 때문이다(`petty-cash/append.ts`). 읽는 쪽이 되돌리지 않아 화면에
 * `46255` 가 그대로 찍혔다(2026-08-22).
 *
 * **그럴듯한 연도일 때만 바꾼다.** 사람이 `20260821` 처럼 적어둔 칸을 일련번호로
 * 읽으면 서기 57000년이 된다 — 그럴 바엔 원문을 그대로 보여준다.
 */
function normalizeDate(raw: string): string {
  if (!/^\d+$/.test(raw)) return raw;
  const iso = excelSerialToIso(Number(raw));
  const year = Number(iso.slice(0, 4));
  return year >= 2000 && year <= 2100 ? iso : raw;
}

export function parsePettyCashSheet(rows: string[][]): PettyCashSheet {
  const entries: PettyCashEntry[] = [];
  let balanceCell: PettyCashSheet["balanceCell"] = null;

  // 첫 행은 헤더. 데이터 행만 본다. 시트 행 번호는 index + 1 이다 — usedRange 가
  // A1 부터라고 보는 것은 쓰는 쪽(`findInsertRow`)과 같다.
  for (const [i, r] of rows.entries()) {
    if (i === 0) continue;
    const label = (r[COL.refillLabel] ?? "").trim();
    const date = normalizeDate((r[COL.date] ?? "").trim());

    if (label) {
      entries.push({
        kind: "refill",
        before: parseAmount(r[COL.refillBefore]),
        balance: parseAmount(r[COL.balance]),
      });
      balanceCell = { row: i + 1, text: r[COL.balance] ?? "" };
      continue;
    }
    // 날짜가 없으면 빈 줄이다 — 시트 아래에 남아 있다.
    if (!date) continue;

    entries.push({
      kind: "spend",
      date,
      title: (r[COL.title] ?? "").trim(),
      count: parseAmount(r[COL.count]),
      amount: parseAmount(r[COL.amount]),
      item: (r[COL.item] ?? "").trim() || null,
      balance: parseAmount(r[COL.balance]),
    });
    balanceCell = { row: i + 1, text: r[COL.balance] ?? "" };
  }

  const last = entries[entries.length - 1];
  const totalSpent = entries.reduce(
    (a, e) => (e.kind === "spend" ? a + (e.amount ?? 0) : a),
    0,
  );

  return {
    entries,
    balance: last ? (last.balance ?? null) : null,
    totalSpent,
    balanceCell,
  };
}

/**
 * 현재 잔액을 못 읽었을 때 어느 칸을 고칠지 말한다.
 *
 * 2026-10-21 사람이 청구 행을 끼워 넣으며 맨 아래 행 잔액 칸이 비었고, 그 뒤 2주 동안
 * '현재 잔액을 읽지 못했습니다' 만 반복됐다 — 어디가 비었는지 몰라 아무도 못 고쳤다.
 */
export function unreadableBalanceMessage(
  sheetName: string,
  cell: PettyCashSheet["balanceCell"],
): string {
  const head = "현재 잔액을 읽지 못했습니다";
  if (!cell) return `${head} — '${sheetName}' 시트에 장부 행이 없습니다`;
  const at = `'${sheetName}' 시트 ${cell.row}행 잔액(C) 칸이`;
  const text = cell.text.trim();
  return text
    ? `${head} — ${at} 숫자가 아닙니다(${text})`
    : `${head} — ${at} 비어 있습니다`;
}
