import { describe, it, expect } from "vitest";
import type { ReceivablesSheet } from "../queries";
import { groupRecipientsByOwner } from "../mail-grouping";

/** 표준 sheet 생성 헬퍼 — 미수채권 시트 모양을 모사 */
function mkSheet(
  headers: string[],
  rowsText: (string | number)[][],
): ReceivablesSheet {
  return {
    worksheetName: "Sheet1",
    metaRows: [],
    headers,
    rows: rowsText.map((r) => r.map((c) => (typeof c === "number" ? c : c))),
    rowsText: rowsText.map((r) => r.map((c) => String(c))),
    validColIdx: headers.map((_, i) => i),
    headerRowNumber: 1,
    rowCount: rowsText.length + 1,
    columnCount: headers.length,
    fetchedAt: "2026-05-11T00:00:00Z",
  };
}

const HEADERS = [
  "청구일자",
  "거래처명",
  "거래내역",
  "청구금액",
  "경과일수",
  "운영자",
  "학교담당자",
];

// 경과일수는 청구일자 기준으로 계산되므로 결정적 테스트를 위해 기준 시각 고정.
const NOW = new Date("2026-05-08T12:00:00+09:00");

describe("groupRecipientsByOwner", () => {
  it("경과일수 >= thresholdDays 행만 포함", () => {
    const sheet = mkSheet(HEADERS, [
      ["2026-04-01", "A학교", "원서 4월", 1_000_000, 12, "송영신", "a@x.com"],
      ["2026-05-02", "B학교", "원서 5월", 500_000, 9, "송영신", "b@x.com"],
      ["2026-04-15", "C학교", "원서 4월", 700_000, 10, "송영신", "c@x.com"],
    ]);

    const { groups } = groupRecipientsByOwner(sheet, 10, NOW);
    const emails = groups.map((g) => g.recipient.email).sort();
    expect(emails).toEqual(["a@x.com", "c@x.com"]);
  });

  it("같은 학교담당자 이메일 → 1 그룹으로 묶음 + totalAmount 합산", () => {
    const sheet = mkSheet(HEADERS, [
      ["2026-04-01", "A학교", "원서 4월", 1_000_000, 12, "송영신", "same@x.com"],
      ["2026-04-15", "A학교 분교", "원서 4월", 500_000, 11, "송영신", "same@x.com"],
    ]);

    const { groups } = groupRecipientsByOwner(sheet, 10, NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].recipient.email).toBe("same@x.com");
    expect(groups[0].items).toHaveLength(2);
    expect(groups[0].totalAmount).toBe(1_500_000);
  });

  it("잘못된 이메일 형식 셀 → excluded[]에 invalid_email", () => {
    const sheet = mkSheet(HEADERS, [
      ["2026-04-01", "A학교", "원서 4월", 1_000_000, 12, "송영신", "not-an-email"],
      ["2026-04-15", "B학교", "원서 4월", 500_000, 11, "송영신", "ok@x.com"],
    ]);

    const { groups, excluded } = groupRecipientsByOwner(sheet, 10, NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].recipient.email).toBe("ok@x.com");
    const reasons = excluded.map((e) => e.reason);
    expect(reasons).toContain("invalid_email");
  });

  it("학교담당자 컬럼 누락 시 groups=[], excluded에 missing_owner_column", () => {
    const headersNoOwner = HEADERS.filter((h) => h !== "학교담당자");
    const sheet = mkSheet(headersNoOwner, [
      ["2026-04-01", "A학교", "원서 4월", 1_000_000, 12, "송영신"],
    ]);

    const { groups, excluded } = groupRecipientsByOwner(sheet, 10, NOW);
    expect(groups).toEqual([]);
    expect(excluded.some((e) => e.reason === "missing_owner_column")).toBe(true);
  });

  it("청구일자 컬럼 누락 시 groups=[], excluded에 missing_billing_date_column", () => {
    const headersNoBilling = HEADERS.filter((h) => h !== "청구일자");
    const sheet = mkSheet(headersNoBilling, [
      ["A학교", "원서 4월", 1_000_000, 12, "송영신", "a@x.com"],
    ]);

    const { groups, excluded } = groupRecipientsByOwner(sheet, 10, NOW);
    expect(groups).toEqual([]);
    expect(
      excluded.some((e) => e.reason === "missing_billing_date_column"),
    ).toBe(true);
  });
});
