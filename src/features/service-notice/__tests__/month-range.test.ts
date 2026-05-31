import { describe, it, expect } from "vitest";
import { nextMonthRangeKST } from "../month-range";

describe("nextMonthRangeKST", () => {
  it("5월 기준 → 다음 달 6월 범위 (KST 경계, monthKey)", () => {
    const r = nextMonthRangeKST(new Date("2026-05-31T05:00:00Z")); // KST 14:00 5/31
    expect(r.monthKey).toBe("2026-06");
    // 2026-06-01 00:00 KST = 2026-05-31T15:00:00Z
    expect(r.startISO).toBe("2026-05-31T15:00:00.000Z");
    // 2026-07-01 00:00 KST = 2026-06-30T15:00:00Z
    expect(r.endISO).toBe("2026-06-30T15:00:00.000Z");
  });

  it("12월 → 다음 해 1월로 롤오버", () => {
    const r = nextMonthRangeKST(new Date("2026-12-15T03:00:00Z")); // KST 12/15
    expect(r.monthKey).toBe("2027-01");
    // 2027-01-01 00:00 KST = 2026-12-31T15:00:00Z
    expect(r.startISO).toBe("2026-12-31T15:00:00.000Z");
    // 2027-02-01 00:00 KST = 2027-01-31T15:00:00Z
    expect(r.endISO).toBe("2027-01-31T15:00:00.000Z");
  });
});
