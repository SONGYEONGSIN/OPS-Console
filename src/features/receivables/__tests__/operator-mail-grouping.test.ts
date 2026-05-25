import { describe, it, expect } from "vitest";
import { groupReceivablesByOperator } from "../operator-mail-grouping";
import type { ReceivablesSheet } from "../queries";

function makeSheet(
  headers: string[],
  rowsText: string[][],
  rows: unknown[][],
): ReceivablesSheet {
  return {
    worksheetName: "test",
    metaRows: [],
    headers,
    rows,
    rowsText,
    validColIdx: headers.map((_, i) => i),
    headerRowNumber: 1,
    rowCount: rowsText.length,
    columnCount: headers.length,
    fetchedAt: new Date().toISOString(),
  };
}

describe("groupReceivablesByOperator", () => {
  it("운영자 이름 → OPERATORS 매핑으로 이메일 결정 + 그룹화", () => {
    const sheet = makeSheet(
      ["청구일자", "거래처명", "운영자", "청구금액", "경과일수", "적요"],
      [
        ["2026-04-10", "가천대", "김슬기", "100000", "30", ""],
        ["2026-04-15", "고려대", "김슬기", "50000", "25", ""],
        ["2026-04-20", "성균관대", "정윤나", "80000", "20", ""],
      ],
      [
        ["2026-04-10", "가천대", "김슬기", 100000, 30, ""],
        ["2026-04-15", "고려대", "김슬기", 50000, 25, ""],
        ["2026-04-20", "성균관대", "정윤나", 80000, 20, ""],
      ],
    );
    const { groups, excluded } = groupReceivablesByOperator(sheet, 10);
    expect(groups).toHaveLength(2);

    const sgk = groups.find((g) => g.operator.name === "김슬기");
    expect(sgk).toBeDefined();
    expect(sgk!.operator.email).toBe("bluewhich87@jinhakapply.com");
    expect(sgk!.items).toHaveLength(2);
    expect(sgk!.totalAmount).toBe(150000);

    const jyn = groups.find((g) => g.operator.name === "정윤나");
    expect(jyn!.operator.email).toBe("annooy@jinhakapply.com");
    expect(jyn!.items).toHaveLength(1);
    expect(jyn!.totalAmount).toBe(80000);

    expect(excluded).toEqual([]);
  });

  it("경과일수 < threshold 행은 excluded(below_threshold)로 제외", () => {
    const sheet = makeSheet(
      ["거래처명", "운영자", "청구금액", "경과일수", "적요"],
      [
        ["가천대", "김슬기", "100000", "30", ""],
        ["고려대", "김슬기", "50000", "5", ""],
      ],
      [
        ["가천대", "김슬기", 100000, 30, ""],
        ["고려대", "김슬기", 50000, 5, ""],
      ],
    );
    const { groups, excluded } = groupReceivablesByOperator(sheet, 10);
    expect(groups[0].items).toHaveLength(1);
    expect(excluded.some((e) => e.reason === "below_threshold")).toBe(true);
  });

  it("적요(K열) 비어있지 않은 행은 silent skip (이미 처리완료)", () => {
    const sheet = makeSheet(
      ["거래처명", "운영자", "청구금액", "경과일수", "적요"],
      [
        ["가천대", "김슬기", "100000", "30", ""],
        ["고려대", "김슬기", "50000", "30", "입금완료"],
      ],
      [
        ["가천대", "김슬기", 100000, 30, ""],
        ["고려대", "김슬기", 50000, 30, "입금완료"],
      ],
    );
    const { groups } = groupReceivablesByOperator(sheet, 10);
    expect(groups[0].items).toHaveLength(1);
    expect(groups[0].items[0].customerName).toBe("가천대");
  });

  it("OPERATORS에 없는 이름은 excluded(operator_email_not_mapped)", () => {
    const sheet = makeSheet(
      ["거래처명", "운영자", "청구금액", "경과일수", "적요"],
      [["가천대", "유령운영자", "100000", "30", ""]],
      [["가천대", "유령운영자", 100000, 30, ""]],
    );
    const { groups, excluded } = groupReceivablesByOperator(sheet, 10);
    expect(groups).toEqual([]);
    expect(excluded).toEqual([
      expect.objectContaining({ reason: "operator_email_not_mapped" }),
    ]);
  });

  it("운영자 컬럼 빈 행은 excluded(operator_not_found)", () => {
    const sheet = makeSheet(
      ["거래처명", "운영자", "청구금액", "경과일수", "적요"],
      [["가천대", "", "100000", "30", ""]],
      [["가천대", "", 100000, 30, ""]],
    );
    const { excluded } = groupReceivablesByOperator(sheet, 10);
    expect(
      excluded.some((e) => e.reason === "operator_not_found"),
    ).toBe(true);
  });

  it("운영자/경과일수 컬럼 누락 → 빈 결과 + 사유 기록", () => {
    const sheet = makeSheet(
      ["거래처명", "청구금액"],
      [["가천대", "100000"]],
      [["가천대", 100000]],
    );
    const { groups, excluded } = groupReceivablesByOperator(sheet, 10);
    expect(groups).toEqual([]);
    expect(
      excluded.some((e) => e.reason === "missing_operator_column"),
    ).toBe(true);
    expect(
      excluded.some((e) => e.reason === "missing_overdue_column"),
    ).toBe(true);
  });
});
