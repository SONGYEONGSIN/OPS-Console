import type { LedgerLine } from "./ledger";

/**
 * 대장 목록 다루기 — 연도·검색·월 묶음.
 *
 * 266행이 **일자별**로 갈려 화면이 끝없이 길어졌다(2026-08-20 지적). 월 단위로 묶고
 * 페이지로 끊는다. 연도는 시트가 곧 연도라 시트 목록에서 뽑는다 — 코드에 박으면
 * 내년에 안 늘어난다.
 */

/** 한 페이지에 담는 행 수. 묶음이 아니라 행 기준이라 페이지 길이가 고르다. */
export const LEDGER_PAGE_SIZE = 50;

/** `2026년도 우편물발송(04월~)` 만 대장이다. `2025 우편물 담당자`는 다른 표다. */
const SHEET_RE = /^(\d{4})년도 우편물발송/;

export function ledgerYears(sheetNames: string[]): number[] {
  const years = new Set<number>();
  for (const name of sheetNames) {
    const m = SHEET_RE.exec(name.trim());
    if (m) years.add(Number(m[1]));
  }
  return [...years].sort((a, b) => b - a);
}

/** 등기번호는 사람이 하이픈 없이 치기도 한다. 둘 다 찾히게 붙인 형태도 본다. */
const digits = (s: string) => s.replace(/\D/g, "");

export function filterLedger(rows: LedgerLine[], query: string): LedgerLine[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const qDigits = digits(q);
  return rows.filter((r) => {
    const hay = [
      r.recipientOrg,
      r.recipientName,
      r.assignee,
      r.confirmedBy,
      r.trackingNo,
      r.note,
    ]
      .join(" ")
      .toLowerCase();
    if (hay.includes(q)) return true;
    // 숫자만 친 경우 — 하이픈을 뺀 등기번호와 맞춰 본다.
    return qDigits.length > 0 && digits(r.trackingNo).includes(qDigits);
  });
}

/** 월 단위 묶음. 최신 달이 위, 달 안에서도 최근 날짜가 위. */
export function groupByMonth(rows: LedgerLine[]): [string, LedgerLine[]][] {
  const byMonth = new Map<string, LedgerLine[]>();
  for (const r of rows) {
    const month = r.sentOn.slice(0, 7);
    const list = byMonth.get(month) ?? [];
    list.push(r);
    byMonth.set(month, list);
  }
  return [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([month, list]) => [
      month,
      // 대장은 아래로 쌓이지만 화면은 최근이 먼저다.
      [...list].sort((a, b) => (a.sentOn < b.sentOn ? 1 : -1)),
    ]);
}
