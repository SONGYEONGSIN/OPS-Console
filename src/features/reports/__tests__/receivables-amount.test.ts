import { describe, it, expect } from "vitest";
import { sumAmountColumn } from "../receivables-amount";

describe("sumAmountColumn", () => {
  const headers = ["청구일자", "거래처명", "청구금액", "입금여부"];

  it("청구금액 컬럼을 합산 (콤마 문자열 파싱)", () => {
    const rows = [
      ["2026-05-06", "서울대", "1,500,000", "미수"],
      ["2026-05-06", "연세대", "980000", "미수"],
    ];
    expect(sumAmountColumn(headers, rows, [])).toBe(2_480_000);
  });

  it("숫자값(number)도 합산", () => {
    const rows: unknown[][] = [
      ["2026-05-06", "서울대", 1500000, "미수"],
      ["2026-05-06", "연세대", 980000, "미수"],
    ];
    expect(sumAmountColumn(headers, rows, [])).toBe(2_480_000);
  });

  it("음수/빈값/비숫자는 제외", () => {
    const rows = [
      ["", "A", "-100", ""],
      ["", "B", "", ""],
      ["", "C", "abc", ""],
      ["", "D", "500", ""],
    ];
    expect(sumAmountColumn(headers, rows, [])).toBe(500);
  });

  it("values가 비면 rowsText에서 파싱", () => {
    const rows: unknown[][] = [[null, null, null, null]];
    const text = [["2026-05-06", "서울대", "1,200,000", "미수"]];
    expect(sumAmountColumn(headers, rows, text)).toBe(1_200_000);
  });

  it("금액 컬럼이 없으면 0", () => {
    expect(sumAmountColumn(["a", "b"], [["1", "2"]], [])).toBe(0);
  });
});
