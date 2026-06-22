import { describe, it, expect } from "vitest";
import { groupReceivablesByOperator } from "../operator-mail-grouping";
import type { ReceivablesSheet } from "../queries";

// 경과일수는 청구일자 기준으로 계산되므로 결정적 테스트를 위해 기준 시각 고정.
const NOW = new Date("2026-05-30T12:00:00+09:00");

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
    fetchedAt: new Date().toISOString(),
    columnCount: headers.length,
  };
}

describe("groupReceivablesByOperator", () => {
  it("경과일수 컬럼 없이 청구일자로 경과일을 계산해 그룹화한다", () => {
    // 시트엔 '경과일수' 컬럼이 없음(운영 시트 실제 형태). 청구일자로 계산.
    const sheet = makeSheet(
      ["청구일자", "거래처명", "운영자", "청구금액", "적 요(피드백 내용)"],
      [
        ["2026-04-30", "가천대", "김슬기", "100000", ""], // 30일
        ["2026-05-05", "고려대", "김슬기", "50000", ""], // 25일
        ["2026-05-10", "성균관대", "정윤나", "80000", ""], // 20일
      ],
      [
        ["2026-04-30", "가천대", "김슬기", 100000, ""],
        ["2026-05-05", "고려대", "김슬기", 50000, ""],
        ["2026-05-10", "성균관대", "정윤나", 80000, ""],
      ],
    );
    const { groups, excluded } = groupReceivablesByOperator(sheet, 10, NOW);
    expect(groups).toHaveLength(2);

    const sgk = groups.find((g) => g.operator.name === "김슬기");
    expect(sgk!.operator.email).toBe("bluewhich87@jinhak.com");
    expect(sgk!.items).toHaveLength(2);
    expect(sgk!.totalAmount).toBe(150000);
    expect(sgk!.items[0].daysOverdue).toBe(30);

    const jyn = groups.find((g) => g.operator.name === "정윤나");
    expect(jyn!.operator.email).toBe("annooy@jinhakapply.com");
    expect(jyn!.items).toHaveLength(1);
    expect(jyn!.totalAmount).toBe(80000);

    expect(excluded).toEqual([]);
  });

  it("경과일수 < threshold 행은 excluded(below_threshold)", () => {
    const sheet = makeSheet(
      ["청구일자", "거래처명", "운영자", "청구금액", "적요"],
      [
        ["2026-04-30", "가천대", "김슬기", "100000", ""], // 30일
        ["2026-05-28", "고려대", "김슬기", "50000", ""], // 2일
      ],
      [
        ["2026-04-30", "가천대", "김슬기", 100000, ""],
        ["2026-05-28", "고려대", "김슬기", 50000, ""],
      ],
    );
    const { groups, excluded } = groupReceivablesByOperator(sheet, 10, NOW);
    expect(groups[0].items).toHaveLength(1);
    expect(excluded.some((e) => e.reason === "below_threshold")).toBe(true);
  });

  it("미래 청구일자(경과 음수)는 silent skip", () => {
    const sheet = makeSheet(
      ["청구일자", "거래처명", "운영자", "청구금액", "적요"],
      [["2026-06-10", "가천대", "김슬기", "100000", ""]], // 미래
      [["2026-06-10", "가천대", "김슬기", 100000, ""]],
    );
    const { groups, excluded } = groupReceivablesByOperator(sheet, 10, NOW);
    expect(groups).toEqual([]);
    expect(excluded).toEqual([]); // below_threshold도 아닌 단순 skip
  });

  it("적요(피드백) 비어있지 않은 행은 silent skip — 헤더 '적 요(피드백 내용)' 매칭", () => {
    const sheet = makeSheet(
      ["청구일자", "거래처명", "운영자", "청구금액", "적 요(피드백 내용)"],
      [
        ["2026-04-30", "가천대", "김슬기", "100000", ""],
        ["2026-04-30", "고려대", "김슬기", "50000", "입금완료"],
      ],
      [
        ["2026-04-30", "가천대", "김슬기", 100000, ""],
        ["2026-04-30", "고려대", "김슬기", 50000, "입금완료"],
      ],
    );
    const { groups } = groupReceivablesByOperator(sheet, 10, NOW);
    expect(groups[0].items).toHaveLength(1);
    expect(groups[0].items[0].customerName).toBe("가천대");
  });

  it("OPERATORS에 없는 이름은 excluded(operator_email_not_mapped)", () => {
    const sheet = makeSheet(
      ["청구일자", "거래처명", "운영자", "청구금액", "적요"],
      [["2026-04-30", "가천대", "유령운영자", "100000", ""]],
      [["2026-04-30", "가천대", "유령운영자", 100000, ""]],
    );
    const { groups, excluded } = groupReceivablesByOperator(sheet, 10, NOW);
    expect(groups).toEqual([]);
    expect(excluded).toEqual([
      expect.objectContaining({ reason: "operator_email_not_mapped" }),
    ]);
  });

  it("운영자 컬럼 빈 행은 excluded(operator_not_found)", () => {
    const sheet = makeSheet(
      ["청구일자", "거래처명", "운영자", "청구금액", "적요"],
      [["2026-04-30", "가천대", "", "100000", ""]],
      [["2026-04-30", "가천대", "", 100000, ""]],
    );
    const { excluded } = groupReceivablesByOperator(sheet, 10, NOW);
    expect(excluded.some((e) => e.reason === "operator_not_found")).toBe(true);
  });

  it("운영자/청구일자 컬럼 누락 → 빈 결과 + 사유 기록", () => {
    const sheet = makeSheet(
      ["거래처명", "청구금액"],
      [["가천대", "100000"]],
      [["가천대", 100000]],
    );
    const { groups, excluded } = groupReceivablesByOperator(sheet, 10, NOW);
    expect(groups).toEqual([]);
    expect(excluded.some((e) => e.reason === "missing_operator_column")).toBe(true);
    expect(excluded.some((e) => e.reason === "missing_billing_date_column")).toBe(true);
  });
});
