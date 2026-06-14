import { describe, it, expect } from "vitest";
import { academicYearRange } from "../academic-year";

describe("academicYearRange", () => {
  it("3월~연말은 다음해 학년도 (2026-06 → 2027학년도)", () => {
    const r = academicYearRange("2026-06-13");
    expect(r.start).toBe("2026-03-01");
    expect(r.end).toBe("2027-03-01");
    expect(r.label).toBe(2027);
  });

  it("3월 1일 경계는 새 학년도 시작", () => {
    const r = academicYearRange("2026-03-01");
    expect(r.start).toBe("2026-03-01");
    expect(r.label).toBe(2027);
  });

  it("1~2월은 직전 시작연도 학년도 (2026-02 → 2026학년도)", () => {
    const r = academicYearRange("2026-02-28");
    expect(r.start).toBe("2025-03-01");
    expect(r.end).toBe("2026-03-01");
    expect(r.label).toBe(2026);
  });

  it("다음 해로 자동 롤오버 (2027-04 → 2028학년도)", () => {
    const r = academicYearRange("2027-04-10");
    expect(r.start).toBe("2027-03-01");
    expect(r.end).toBe("2028-03-01");
    expect(r.label).toBe(2028);
  });
});
