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
      ["2026-05-06", "A", "-100", ""],
      ["2026-05-06", "B", "", ""],
      ["2026-05-06", "C", "abc", ""],
      ["2026-05-06", "D", "500", ""],
    ];
    expect(sumAmountColumn(headers, rows, [])).toBe(500);
  });

  it("합계/소계 행과 청구일자 빈 행은 제외 (미수채권 메뉴와 동일 기준)", () => {
    const rows = [
      ["2026-05-06", "서울대", "1,000", "미수"],
      ["", "합계", "69,537,750", ""],
      ["", "이월분(일자없음)", "2,000", ""],
      ["2026-05-07", "연세대", "3,000", "미수"],
    ];
    expect(sumAmountColumn(headers, rows, [])).toBe(4_000);
  });

  it("values가 비면 rowsText에서 파싱", () => {
    const rows: unknown[][] = [[null, null, null, null]];
    const text = [["2026-05-06", "서울대", "1,200,000", "미수"]];
    expect(sumAmountColumn(headers, rows, text)).toBe(1_200_000);
  });

  it("금액 컬럼이 없으면 0", () => {
    expect(sumAmountColumn(["a", "b"], [["1", "2"]], [])).toBe(0);
  });

  it("입금완료 행(상태 컬럼)은 합산 제외 — 미수 행만", () => {
    const rows = [
      ["2026-05-06", "서울대", "1,500,000", "미수"],
      ["2026-05-06", "연세대", "980,000", "입금"],
      ["2026-05-06", "고려대", "700,000", "수금"],
    ];
    expect(sumAmountColumn(headers, rows, [])).toBe(1_500_000);
  });

  it("적요 '입금완료' 행도 제외", () => {
    const withRemarks = [
      "청구일자",
      "거래처명",
      "청구금액",
      "입금여부",
      "적요",
    ];
    const rows = [
      ["2026-05-06", "서울대", "1,500,000", "", "5/30 입금완료"],
      ["2026-05-06", "연세대", "980,000", "", ""],
    ];
    expect(sumAmountColumn(withRemarks, rows, [])).toBe(980_000);
  });

  it("상태/적요 컬럼이 없으면 전체 합산 (기존 동작 유지)", () => {
    const noStatus = ["청구일자", "거래처명", "청구금액"];
    const rows = [
      ["2026-05-06", "서울대", "1,000"],
      ["2026-05-06", "연세대", "2,000"],
    ];
    expect(sumAmountColumn(noStatus, rows, [])).toBe(3_000);
  });
});
