import { describe, it, expect } from "vitest";
import { fiscalYearRangeKST } from "../fiscal-year";

/**
 * 회계연도 4/01~익년 3/31, KST 기준 동적 산출.
 * 오늘이 4월 이후면 올해 시작, 3월 이전이면 작년 시작 → 매년 자동 +1.
 */
describe("fiscalYearRangeKST", () => {
  it("4월 이후 — 올해 4/01 ~ 익년 3/31", () => {
    const r = fiscalYearRangeKST(new Date("2026-04-15T10:00:00+09:00"));
    expect(r).toEqual({ startYmd: "20260401", endYmd: "20270331" });
  });

  it("3월 이전(1~3월) — 작년 4/01 ~ 올해 3/31", () => {
    const r = fiscalYearRangeKST(new Date("2026-02-10T10:00:00+09:00"));
    expect(r).toEqual({ startYmd: "20250401", endYmd: "20260331" });
  });

  it("경계 — 3/31 KST는 직전 회계연도(작년 시작)", () => {
    const r = fiscalYearRangeKST(new Date("2026-03-31T23:59:00+09:00"));
    expect(r).toEqual({ startYmd: "20250401", endYmd: "20260331" });
  });

  it("경계 — 4/01 KST는 새 회계연도(올해 시작)", () => {
    const r = fiscalYearRangeKST(new Date("2026-04-01T00:00:00+09:00"));
    expect(r).toEqual({ startYmd: "20260401", endYmd: "20270331" });
  });

  it("KST 변환 — UTC상 전날이라도 KST 날짜 기준 (4/1 00:30 KST = 3/31 15:30 UTC)", () => {
    // UTC로는 2026-03-31이지만 KST로는 2026-04-01 → 새 회계연도
    const r = fiscalYearRangeKST(new Date("2026-03-31T15:30:00Z"));
    expect(r).toEqual({ startYmd: "20260401", endYmd: "20270331" });
  });
});
