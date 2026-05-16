import { describe, it, expect } from "vitest";
import { currentAcademicYear } from "../datetime";

describe("currentAcademicYear", () => {
  it("2026-03-01 KST 자정 → 2027학년도", () => {
    expect(currentAcademicYear(new Date("2026-03-01T00:00:00+09:00"))).toBe(2027);
  });

  it("2026-02-28 23:59:59 KST → 2026학년도", () => {
    expect(currentAcademicYear(new Date("2026-02-28T23:59:59+09:00"))).toBe(2026);
  });

  it("2026-05-16 KST → 2027학년도 (현 시점 default)", () => {
    expect(currentAcademicYear(new Date("2026-05-16T12:00:00+09:00"))).toBe(2027);
  });

  it("2024-03-01 KST → 2025학년도 (시트 데이터 기준)", () => {
    expect(currentAcademicYear(new Date("2024-03-01T00:00:00+09:00"))).toBe(2025);
  });

  it("2025-02-15 KST → 2025학년도 (시트 데이터 막바지)", () => {
    expect(currentAcademicYear(new Date("2025-02-15T12:00:00+09:00"))).toBe(2025);
  });
});
