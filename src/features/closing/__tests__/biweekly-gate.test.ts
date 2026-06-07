import { describe, it, expect } from "vitest";
import { shouldRunThisWeek } from "../biweekly-gate";

/**
 * anchor(기준 월요일) 기반 격주 게이트.
 * (thisMonday - anchorMonday) / 7일 의 짝수 주만 실행 → 14일 간격 = anchor와 같은 패리티 주.
 * KST 기준. anchor = 2026-06-08(월).
 */
const ANCHOR = "2026-06-08";

describe("shouldRunThisWeek", () => {
  it("anchor 당주 — 실행", () => {
    expect(shouldRunThisWeek(new Date("2026-06-08T10:00:00+09:00"), ANCHOR)).toBe(
      true,
    );
  });

  it("anchor +1주 — 스킵", () => {
    expect(shouldRunThisWeek(new Date("2026-06-15T10:00:00+09:00"), ANCHOR)).toBe(
      false,
    );
  });

  it("anchor +2주 — 실행 (14일 간격)", () => {
    expect(shouldRunThisWeek(new Date("2026-06-22T10:00:00+09:00"), ANCHOR)).toBe(
      true,
    );
  });

  it("anchor +3주 — 스킵", () => {
    expect(shouldRunThisWeek(new Date("2026-06-29T10:00:00+09:00"), ANCHOR)).toBe(
      false,
    );
  });

  it("같은 주 내 다른 요일(목요일)도 당주 월요일 기준 — anchor 주는 실행", () => {
    expect(shouldRunThisWeek(new Date("2026-06-11T10:00:00+09:00"), ANCHOR)).toBe(
      true,
    );
  });

  it("anchor 이전 주(-1주) — 스킵", () => {
    expect(shouldRunThisWeek(new Date("2026-06-01T10:00:00+09:00"), ANCHOR)).toBe(
      false,
    );
  });

  it("연말 경계 강건 — anchor +28주(짝수)는 실행 (해 경계 통과)", () => {
    // 2026-06-08 + 28주 = 2026-12-21 (월)
    expect(shouldRunThisWeek(new Date("2026-12-21T10:00:00+09:00"), ANCHOR)).toBe(
      true,
    );
  });

  it("연말 경계 강건 — anchor +29주(홀수)는 스킵 (53주 패리티 영향 없음)", () => {
    // 2026-12-21 + 7일 = 2026-12-28 (월)
    expect(shouldRunThisWeek(new Date("2026-12-28T10:00:00+09:00"), ANCHOR)).toBe(
      false,
    );
  });
});
