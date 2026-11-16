import { describe, expect, it } from "vitest";
import { weekDateRange } from "@/features/automations/jobs/weekly-report/rollover-logic";
import { nextWeekRange } from "@/features/closing/next-week";
import {
  canCreateWeek,
  defaultWeekStart,
  referenceInstant,
  shiftWeek,
  weekOf,
  weekRefFromStart,
  weekWindows,
  weeksBetween,
  ymdInRange,
} from "../week";

describe("week", () => {
  it.each([
    ["2026-11-16T03:00:00Z", "2026-11-16", "2026년 11월 3주차", "11/16~11/20"],
    ["2026-11-22T14:59:59Z", "2026-11-16", "2026년 11월 3주차", "11/16~11/20"],
    ["2026-11-15T15:00:00Z", "2026-11-16", "2026년 11월 3주차", "11/16~11/20"],
    ["2026-11-15T14:59:59Z", "2026-11-09", "2026년 11월 2주차", "11/9~11/13"],
    ["2026-12-31T03:00:00Z", "2026-12-28", "2026년 12월 5주차", "12/28~1/1"],
    ["2026-06-29T03:00:00Z", "2026-06-29", "2026년 7월 1주차", "6/29~7/3"],
    ["2026-03-30T03:00:00Z", "2026-03-30", "2026년 4월 1주차", "3/30~4/3"],
    ["2026-11-30T03:00:00Z", "2026-11-30", "2026년 12월 1주차", "11/30~12/4"],
  ])("weekOf(%s) = %s %s", (iso, start, label, range) => {
    const w = weekOf(new Date(iso));
    expect([w.weekStart, w.label, w.rangeLabel]).toEqual([start, label, range]);
  });

  it("weekOf 는 본부 weekDateRange 와 왕복한다", () => {
    const w = weekOf(new Date("2026-12-31T03:00:00Z"));
    expect(
      weekDateRange(w.year, w.month, w.week).monday.toISOString().slice(0, 10),
    ).toBe(w.weekStart);
  });

  it("weekRefFromStart 는 월요일만 받는다", () => {
    expect(weekRefFromStart("2026-11-17")).toBeNull();
    expect(weekRefFromStart("2026-13-01")).toBeNull();
    expect(weekRefFromStart("garbage")).toBeNull();
    expect(weekRefFromStart("2026-11-16")?.label).toBe("2026년 11월 3주차");
  });

  it("shiftWeek / weeksBetween 연도 경계", () => {
    expect(shiftWeek("2026-12-28", 1)).toBe("2027-01-04");
    expect(weeksBetween("2026-11-02", "2026-11-16")).toBe(2);
    expect(weeksBetween("2026-11-16", "2026-11-02")).toBe(-2);
  });

  it("weekWindows — 월~일 KST", () => {
    const w = weekWindows("2026-11-16");
    expect(w.thisWeek).toEqual({
      startYmd: "2026-11-16",
      endYmd: "2026-11-22",
    });
    expect(w.nextWeek).toEqual({
      startYmd: "2026-11-23",
      endYmd: "2026-11-29",
    });
    expect(w.startInstant.toISOString()).toBe("2026-11-15T15:00:00.000Z");
    expect(w.endInstant.toISOString()).toBe("2026-11-22T14:59:59.999Z");
    expect(w.nextWeek).toEqual(nextWeekRange(w.startInstant));
  });

  it("ymdInRange 는 양끝을 포함한다", () => {
    const r = { startYmd: "2026-11-16", endYmd: "2026-11-22" };
    expect(ymdInRange("2026-11-16", r)).toBe(true);
    expect(ymdInRange("2026-11-22", r)).toBe(true);
    expect(ymdInRange("2026-11-23", r)).toBe(false);
  });

  it("referenceInstant 는 그 주 안으로 자른다", () => {
    const now = new Date("2026-11-19T01:00:00Z");
    expect(referenceInstant("2026-11-23", now).toISOString()).toBe(
      "2026-11-22T15:00:00.000Z",
    );
    expect(referenceInstant("2026-11-09", now).toISOString()).toBe(
      "2026-11-15T14:59:59.999Z",
    );
    expect(referenceInstant("2026-11-16", now)).toEqual(now);
  });

  it("canCreateWeek — 이번 주, 그리고 이번 주가 보고됐을 때만 다음 주", () => {
    const now = new Date("2026-11-18T01:00:00Z");
    expect(canCreateWeek("2026-11-16", now, false)).toBe(true);
    expect(canCreateWeek("2026-11-23", now, false)).toBe(false);
    expect(canCreateWeek("2026-11-23", now, true)).toBe(true);
    expect(canCreateWeek("2026-11-30", now, true)).toBe(false);
    expect(canCreateWeek("2026-11-09", now, false)).toBe(false);
  });

  it("defaultWeekStart", () => {
    const now = new Date("2026-11-19T08:00:00Z");
    expect(defaultWeekStart(now, false)).toBe("2026-11-16");
    expect(defaultWeekStart(now, true)).toBe("2026-11-23");
  });
});
