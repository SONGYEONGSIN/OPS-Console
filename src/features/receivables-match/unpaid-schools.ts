import type { ReceivablesSheet } from "@/features/receivables/queries";
import { isPaidReceivableRow } from "@/features/receivables/paid-row";
import { isReceivablesDataCells } from "@/features/receivables/sheet-row";
import { pickReceivablesColumns } from "@/app/dashboard/receivables/_row-mapper";
import { toIsoDate } from "./collect";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toAmount(raw: unknown): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  const n = Number(String(raw ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

/** 날짜로 못 읽는 값은 맨 뒤로 보낸다 — 임의 날짜로 바꾸지 않는다. */
function sortKey(rawDate: string): string {
  const iso = toIsoDate(rawDate);
  return ISO_DATE.test(iso) ? iso : "9999-99-99";
}

/**
 * 지금 미수인 학교 이름 목록 — 가장 오래 밀린 학교가 위.
 *
 * 미수 판정은 미수채권 메뉴와 같은 단일 소스를 쓴다(상태·적요 열 선택은
 * `pickReceivablesColumns`, 수금 판정은 `isPaidReceivableRow`, 데이터 행은
 * `isReceivablesDataCells`). 새 판정을 만들면 메뉴와 V열이 어긋난다.
 *
 * `excludeRowNumbers` 는 방금 매칭 PATCH 가 성공한 미수 행(시트 1-based) —
 * 시트를 다시 읽지 않고 이미 읽은 값에서 빼서, 방금 입금완료된 학교가 빠지게 한다.
 * 이름은 사람이 읽고 복사하는 값이라 정규화하지 않는다.
 */
export function listUnpaidSchools(
  sheet: ReceivablesSheet,
  excludeRowNumbers: ReadonlySet<number>,
): string[] {
  const cols = pickReceivablesColumns(sheet.headers);
  if (cols.name < 0 || cols.date < 0 || cols.amount < 0) return [];

  const earliest = new Map<string, string>();
  sheet.rowsText.forEach((textRow, i) => {
    if (excludeRowNumbers.has(sheet.headerRowNumber + 1 + i)) return;
    const valuesRow = sheet.rows[i] ?? [];
    const text = (ci: number) => (ci >= 0 ? (textRow[ci] ?? "") : "");
    const cells = sheet.headers.map((_, ci) =>
      textRow[ci] ? textRow[ci] : String(valuesRow[ci] ?? ""),
    );
    const name = text(cols.name).trim();
    const date = text(cols.date).trim();
    if (!name || !isReceivablesDataCells(cells, date)) return;
    if (toAmount(valuesRow[cols.amount] ?? textRow[cols.amount]) === 0) return;
    if (isPaidReceivableRow(text(cols.status), text(cols.remarks))) return;

    const key = sortKey(date);
    const prev = earliest.get(name);
    if (prev === undefined || key < prev) earliest.set(name, key);
  });

  return [...earliest.entries()]
    .sort(([na, da], [nb, db]) => da.localeCompare(db) || na.localeCompare(nb, "ko"))
    .map(([name]) => name);
}
