import { describe, it, expect } from "vitest";
import { parseDepositSheet } from "../deposit-queries";

describe("parseDepositSheet — Graph usedRange 응답 → DepositRow[]", () => {
  it("정상 케이스 — 헤더 1행 + 데이터 2행 → DepositRow 2개", () => {
    const usedRange = {
      values: [
        ["No", "거래일시", "구분", "입금금액", "잔액", "거래내용", "x", "y", "z", "w", "미결제표시"],
        [1, "2026-04-15", "입금", 100000, 5000000, "가천대", "", "", "", "", ""],
        [2, "2026-04-16", "입금", 50000, 5050000, "동국대", "", "", "", "", "처리완료"],
      ],
      text: [
        ["No", "거래일시", "구분", "입금금액", "잔액", "거래내용", "x", "y", "z", "w", "미결제표시"],
        ["1", "2026-04-15", "입금", "100,000", "5,000,000", "가천대", "", "", "", "", ""],
        ["2", "2026-04-16", "입금", "50,000", "5,050,000", "동국대", "", "", "", "", "처리완료"],
      ],
    };
    const got = parseDepositSheet(usedRange);
    expect(got).toHaveLength(2);
    expect(got[0]).toEqual({
      row: 2,
      date: "2026-04-15",
      amount: 100000,
      content: "가천대",
      matchedFlag: "",
    });
    expect(got[1]).toEqual({
      row: 3,
      date: "2026-04-16",
      amount: 50000,
      content: "동국대",
      matchedFlag: "처리완료",
    });
  });

  it("빈 시트 → 빈 배열", () => {
    expect(parseDepositSheet({ values: [], text: [] })).toEqual([]);
  });

  it("헤더만 있는 시트 → 빈 배열", () => {
    expect(
      parseDepositSheet({
        values: [["No", "거래일시", "구분", "입금금액"]],
        text: [["No", "거래일시", "구분", "입금금액"]],
      }),
    ).toEqual([]);
  });
});
