import { describe, it, expect } from "vitest";
import { mapPaymentRows } from "../row-map";

const SHEET = "27기비용지급일(26.04~27.03)";

describe("mapPaymentRows", () => {
  it("정상 행을 zero-pad ymd로 매핑한다", () => {
    const rows = [["2026년", "4월", "9일", "개인"]];
    expect(mapPaymentRows(rows, SHEET)).toEqual([
      {
        ymd: "2026-04-09",
        year: 2026,
        month: 4,
        day: 9,
        category: "개인",
        sheetName: SHEET,
      },
    ]);
  });

  it("헤더 행(연도/월/일/개인공용)은 skip한다", () => {
    const rows = [
      ["연도", "월", "일", "개인/공용"],
      ["2026년", "5월", "15일", "공용"],
    ];
    const out = mapPaymentRows(rows, SHEET);
    expect(out).toHaveLength(1);
    expect(out[0].ymd).toBe("2026-05-15");
    expect(out[0].category).toBe("공용");
  });

  it("두 자리 월·일은 그대로, 한 자리는 zero-pad", () => {
    const rows = [
      ["2026년", "12월", "25일", "공용"],
      ["2027년", "1월", "3일", "개인"],
    ];
    const out = mapPaymentRows(rows, SHEET);
    expect(out.map((r) => r.ymd)).toEqual(["2026-12-25", "2027-01-03"]);
  });

  it("월/일이 없거나 범위를 벗어난 행은 skip", () => {
    const rows = [
      ["2026년", "", "9일", "개인"], // 월 없음
      ["2026년", "13월", "9일", "개인"], // 월 범위 초과
      ["2026년", "4월", "32일", "개인"], // 일 범위 초과
      ["", "4월", "9일", "개인"], // 연도 없음
    ];
    expect(mapPaymentRows(rows, SHEET)).toEqual([]);
  });

  it("category(개인/공용)가 비면 skip", () => {
    const rows = [["2026년", "4월", "9일", ""]];
    expect(mapPaymentRows(rows, SHEET)).toEqual([]);
  });

  it("빈 행/누락 컬럼은 안전하게 skip", () => {
    const rows = [[], ["2026년"], ["2026년", "4월"]];
    expect(mapPaymentRows(rows, SHEET)).toEqual([]);
  });
});
