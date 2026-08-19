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
};

/** ` 496,080 ` · `13290` 둘 다 읽는다. 숫자가 아니면 null(0으로 세지 않는다). */
export function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[,\s]/g, "");
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned));
}

export function parsePettyCashSheet(rows: string[][]): PettyCashSheet {
  const entries: PettyCashEntry[] = [];

  // 첫 행은 헤더. 데이터 행만 본다.
  for (const r of rows.slice(1)) {
    const label = (r[COL.refillLabel] ?? "").trim();
    const date = (r[COL.date] ?? "").trim();

    if (label) {
      entries.push({
        kind: "refill",
        before: parseAmount(r[COL.refillBefore]),
        balance: parseAmount(r[COL.balance]),
      });
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
  }

  const last = entries[entries.length - 1];
  const totalSpent = entries.reduce(
    (a, e) => (e.kind === "spend" ? a + (e.amount ?? 0) : a),
    0,
  );

  return { entries, balance: last ? (last.balance ?? null) : null, totalSpent };
}
