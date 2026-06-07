import { describe, it, expect } from "vitest";
import { academicYearRangeKST } from "../academic-year";

/**
 * 학년도 범위 — start = {startYear}-03-01 00:01, end = {startYear+1}-02-{말일} 23:59 (KST).
 * startYear: KST 월 ≥ 3 → 올해, 1~2월 → 작년. 익년 2월 말일은 윤년 동적 산출.
 * 반환 구조화: { start: {date, time}, end: {date, time} }.
 */
describe("academicYearRangeKST", () => {
  it("6월 — 올해 3/01 00:01 ~ 익년 2/28 23:59", () => {
    const r = academicYearRangeKST(new Date("2026-06-07T10:00:00+09:00"));
    expect(r).toEqual({
      start: { date: "2026-03-01", time: "00:01" },
      end: { date: "2027-02-28", time: "23:59" },
    });
  });

  it("1~2월 — 작년 3/01 시작", () => {
    const r = academicYearRangeKST(new Date("2026-01-15T10:00:00+09:00"));
    expect(r).toEqual({
      start: { date: "2025-03-01", time: "00:01" },
      end: { date: "2026-02-28", time: "23:59" },
    });
  });

  it("익년이 윤년 — 2월 말일 29", () => {
    const r = academicYearRangeKST(new Date("2027-06-01T10:00:00+09:00"));
    expect(r).toEqual({
      start: { date: "2027-03-01", time: "00:01" },
      end: { date: "2028-02-29", time: "23:59" },
    });
  });

  it("3월 경계 — 3/01 00:00 KST는 올해 학년도(3월 시작)", () => {
    const r = academicYearRangeKST(new Date("2026-03-01T00:00:00+09:00"));
    expect(r).toEqual({
      start: { date: "2026-03-01", time: "00:01" },
      end: { date: "2027-02-28", time: "23:59" },
    });
  });

  it("2월 말 경계 — 2/28 23:59 KST는 직전 학년도(작년 시작)", () => {
    const r = academicYearRangeKST(new Date("2026-02-28T23:59:00+09:00"));
    expect(r).toEqual({
      start: { date: "2025-03-01", time: "00:01" },
      end: { date: "2026-02-28", time: "23:59" },
    });
  });

  it("UTC↔KST 경계 — 2/28 15:30Z = KST 3/1 00:30 → 올해 학년도", () => {
    const r = academicYearRangeKST(new Date("2026-02-28T15:30:00Z"));
    expect(r).toEqual({
      start: { date: "2026-03-01", time: "00:01" },
      end: { date: "2027-02-28", time: "23:59" },
    });
  });
});
