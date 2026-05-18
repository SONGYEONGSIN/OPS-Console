import { describe, it, expect } from "vitest";
import {
  computeGanttRange,
  computeBarPosition,
  enumerateDays,
} from "../gantt-layout";

describe("computeGanttRange", () => {
  it("items 시작/종료 최솟값/최댓값 반환", () => {
    const range = computeGanttRange([
      { startYmd: "2026-05-20", endYmd: "2026-06-15" },
      { startYmd: "2026-05-10", endYmd: "2026-05-30" },
    ]);
    expect(range).not.toBeNull();
    expect(range?.fromYmd).toBe("2026-05-10");
    expect(range?.toYmd).toBe("2026-06-15");
  });

  it("빈 items — null 반환", () => {
    expect(computeGanttRange([])).toBeNull();
  });

  it("null 날짜 무시", () => {
    const range = computeGanttRange([
      { startYmd: null, endYmd: "2026-06-15" },
      { startYmd: "2026-05-10", endYmd: null },
    ]);
    expect(range).not.toBeNull();
    expect(range?.fromYmd).toBe("2026-05-10");
    expect(range?.toYmd).toBe("2026-06-15");
  });
});

describe("enumerateDays", () => {
  it("from~to (inclusive) ymd 배열", () => {
    const days = enumerateDays("2026-05-10", "2026-05-14");
    expect(days).toEqual([
      "2026-05-10",
      "2026-05-11",
      "2026-05-12",
      "2026-05-13",
      "2026-05-14",
    ]);
  });

  it("월 경계 처리 (4/29 ~ 5/3)", () => {
    const days = enumerateDays("2026-04-29", "2026-05-03");
    expect(days).toEqual([
      "2026-04-29",
      "2026-04-30",
      "2026-05-01",
      "2026-05-02",
      "2026-05-03",
    ]);
  });
});

describe("computeBarPosition", () => {
  it("from=2026-05-01, to=2026-05-31, bar 5/10~5/20", () => {
    const pos = computeBarPosition({
      startYmd: "2026-05-10",
      endYmd: "2026-05-20",
      fromYmd: "2026-05-01",
      toYmd: "2026-05-31",
    });
    // 총 31일, 시작 9일 offset = 9/31 ≈ 29%
    expect(pos.leftPct).toBeCloseTo(29.03, 1);
    // 11일 폭 (10~20 inclusive) / 31일 ≈ 35.48%
    expect(pos.widthPct).toBeCloseTo(35.48, 1);
  });

  it("clamp — bar가 range 밖이면 0/0 반환", () => {
    const pos = computeBarPosition({
      startYmd: "2026-04-01",
      endYmd: "2026-04-30",
      fromYmd: "2026-05-01",
      toYmd: "2026-05-31",
    });
    expect(pos.widthPct).toBe(0);
  });

  it("null 날짜 — 0/0 반환", () => {
    const pos = computeBarPosition({
      startYmd: null,
      endYmd: null,
      fromYmd: "2026-05-01",
      toYmd: "2026-05-31",
    });
    expect(pos.widthPct).toBe(0);
  });
});
