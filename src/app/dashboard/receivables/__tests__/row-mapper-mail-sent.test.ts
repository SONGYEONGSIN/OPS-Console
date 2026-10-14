import { describe, it, expect } from "vitest";
import { receivablesToListRow } from "../_row-mapper";
import type { ReceivablesSheet } from "@/features/receivables/queries";

function sheet(
  headers: string[],
  rows: unknown[][],
  rowsText: string[][],
): ReceivablesSheet {
  return {
    worksheetName: "대장",
    metaRows: [],
    headers,
    rows,
    rowsText,
    validColIdx: headers.map((_, i) => i),
    headerRowNumber: 1,
    rowCount: rows.length,
    columnCount: headers.length,
    fetchedAt: "2026-10-14T00:00:00.000Z",
  };
}

describe("receivablesToListRow — 메일발송일자", () => {
  it("헤더에 메일발송일자가 있으면 그 값이 mailSentDate 로 간다", () => {
    const s = sheet(
      ["청구일자", "거래처", "메일발송일자"],
      [["2026-05-01", "한양대학교", 46000]],
      [["2026-05-01", "한양대학교", "2026-10-01"]],
    );
    expect(receivablesToListRow(s, 0).receivablesCells?.mailSentDate).toBe(
      "2026-10-01",
    );
  });

  it("rowsText 표시 형식이 raw 값보다 우선한다", () => {
    const s = sheet(
      ["청구일자", "거래처", "메일발송일자"],
      [["2026-05-01", "한양대학교", 46000]],
      [["2026-05-01", "한양대학교", "2026.10.01"]],
    );
    expect(receivablesToListRow(s, 0).receivablesCells?.mailSentDate).toBe(
      "2026.10.01",
    );
  });

  it("헤더에 없으면 빈 문자열이다", () => {
    const s = sheet(
      ["청구일자", "거래처"],
      [["2026-05-01", "한양대학교"]],
      [["2026-05-01", "한양대학교"]],
    );
    expect(receivablesToListRow(s, 0).receivablesCells?.mailSentDate).toBe("");
  });
});
