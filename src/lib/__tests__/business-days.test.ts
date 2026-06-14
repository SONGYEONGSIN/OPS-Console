import { describe, it, expect } from "vitest";
import { isKstWeekend, isKstBusinessDay } from "../business-days";

describe("isKstWeekend", () => {
  it("토/일은 주말", () => {
    // 2026-06-13 = 토, 2026-06-14 = 일, 2026-06-15 = 월 (KST 정오 기준)
    expect(isKstWeekend(new Date("2026-06-13T03:00:00Z"))).toBe(true);
    expect(isKstWeekend(new Date("2026-06-14T03:00:00Z"))).toBe(true);
    expect(isKstWeekend(new Date("2026-06-15T03:00:00Z"))).toBe(false);
  });

  it("UTC 늦은 시각도 KST 날짜로 판정", () => {
    // 2026-06-12T20:00:00Z = KST 2026-06-13(토) 05:00
    expect(isKstWeekend(new Date("2026-06-12T20:00:00Z"))).toBe(true);
  });
});

describe("isKstBusinessDay", () => {
  it("평일은 영업일", () => {
    expect(isKstBusinessDay(new Date("2026-06-15T03:00:00Z"))).toBe(true); // 월
  });
  it("주말은 비영업일", () => {
    expect(isKstBusinessDay(new Date("2026-06-13T03:00:00Z"))).toBe(false); // 토
  });
  it("공휴일(신정)은 비영업일", () => {
    expect(isKstBusinessDay(new Date("2026-01-01T03:00:00Z"))).toBe(false);
  });
  it("공휴일(2026 설날 연휴)은 비영업일", () => {
    expect(isKstBusinessDay(new Date("2026-02-17T03:00:00Z"))).toBe(false);
  });
});
