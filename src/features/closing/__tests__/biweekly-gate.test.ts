import { describe, it, expect } from "vitest";
import { shouldRunThisWeek } from "../biweekly-gate";

/**
 * anchor(기준 월요일) 기반 실행 주기 게이트. RUN_INTERVAL_WEEKS=1(주간) 기준.
 * (thisMonday - anchorMonday) / 7주 를 1로 나눠 떨어지면(=항상) 실행 → 매주.
 * KST 기준. anchor = 2026-06-08(월).
 */
const ANCHOR = "2026-06-08";

describe("shouldRunThisWeek — 주간(RUN_INTERVAL_WEEKS=1)", () => {
  it("anchor 당주 — 실행", () => {
    expect(
      shouldRunThisWeek(new Date("2026-06-08T10:00:00+09:00"), ANCHOR),
    ).toBe(true);
  });

  it("anchor +1주 — 실행 (주간이므로 off주 없음)", () => {
    expect(
      shouldRunThisWeek(new Date("2026-06-15T10:00:00+09:00"), ANCHOR),
    ).toBe(true);
  });

  it("anchor +2주 — 실행", () => {
    expect(
      shouldRunThisWeek(new Date("2026-06-22T10:00:00+09:00"), ANCHOR),
    ).toBe(true);
  });

  it("anchor +3주 — 실행", () => {
    expect(
      shouldRunThisWeek(new Date("2026-06-29T10:00:00+09:00"), ANCHOR),
    ).toBe(true);
  });

  it("같은 주 내 다른 요일(목요일)도 실행", () => {
    expect(
      shouldRunThisWeek(new Date("2026-06-11T10:00:00+09:00"), ANCHOR),
    ).toBe(true);
  });

  it("anchor 이전 주(-1주)도 실행", () => {
    expect(
      shouldRunThisWeek(new Date("2026-06-01T10:00:00+09:00"), ANCHOR),
    ).toBe(true);
  });

  it("연말 경계 통과 주도 실행 (anchor +28주)", () => {
    expect(
      shouldRunThisWeek(new Date("2026-12-21T10:00:00+09:00"), ANCHOR),
    ).toBe(true);
  });
});
