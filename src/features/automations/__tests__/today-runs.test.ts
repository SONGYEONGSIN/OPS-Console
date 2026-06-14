import { describe, it, expect } from "vitest";
import { kstDayRangeIso } from "../today-runs";

describe("kstDayRangeIso", () => {
  it("그 날 00:00 ~ 익일 00:00 (KST) ISO 경계를 만든다", () => {
    expect(kstDayRangeIso("2026-06-14")).toEqual({
      startIso: "2026-06-14T00:00:00+09:00",
      endIso: "2026-06-15T00:00:00+09:00",
    });
  });

  it("월말 → 다음 달 1일로 넘어간다 (윤년 2월 포함)", () => {
    expect(kstDayRangeIso("2026-02-28")).toEqual({
      startIso: "2026-02-28T00:00:00+09:00",
      endIso: "2026-03-01T00:00:00+09:00",
    });
  });

  it("연말 → 다음 해 1월 1일로 넘어간다", () => {
    expect(kstDayRangeIso("2026-12-31")).toEqual({
      startIso: "2026-12-31T00:00:00+09:00",
      endIso: "2027-01-01T00:00:00+09:00",
    });
  });

  it("윤년 2월 29일 → 3월 1일", () => {
    // 2028은 윤년
    expect(kstDayRangeIso("2028-02-29")).toEqual({
      startIso: "2028-02-29T00:00:00+09:00",
      endIso: "2028-03-01T00:00:00+09:00",
    });
  });
});
