import { describe, it, expect } from "vitest";
import { toMisuRows } from "../misu-rows";
import type { ReceivablesSheet } from "@/features/receivables/queries";

const sheet: ReceivablesSheet = {
  worksheetName: "미수",
  metaRows: [],
  headers: ["청구일자", "거래처명", "운영자", "청구금액", "경과일수", "적요"],
  rows: [["2026-05-01", "서강대학교", "김슬기", 84000, 30, ""]],
  rowsText: [["2026-05-01", "서강대학교", "김슬기", "84000", "30", ""]],
  validColIdx: [0, 1, 2, 3, 4, 5],
  headerRowNumber: 1,
  rowCount: 1,
  columnCount: 6,
  fetchedAt: new Date().toISOString(),
} as ReceivablesSheet;

describe("toMisuRows", () => {
  it("시트 → MisuRow (rowNumber = headerRowNumber+1+i)", () => {
    const rows = toMisuRows(sheet);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rowNumber: 2,
      date: "2026-05-01",
      customer: "서강대학교",
      amount: 84000,
    });
  });

  it("필수 컬럼(청구일자/거래처/금액) 없으면 빈 배열", () => {
    const bad = { ...sheet, headers: ["x", "y"] } as ReceivablesSheet;
    expect(toMisuRows(bad)).toEqual([]);
  });
});
