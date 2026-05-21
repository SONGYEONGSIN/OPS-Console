import { describe, it, expect } from "vitest";
import { computeCooldownRemaining } from "../queries";

const now = new Date("2026-05-21T12:00:00Z");

describe("computeCooldownRemaining", () => {
  it("lastRunAt 없으면 0", () => {
    expect(computeCooldownRemaining(null, 60, now)).toBe(0);
  });

  it("쿨다운 경과 시 0", () => {
    const last = new Date("2026-05-21T10:00:00Z").toISOString(); // 120분 전
    expect(computeCooldownRemaining(last, 60, now)).toBe(0);
  });

  it("쿨다운 진행 중이면 올림한 잔여 분", () => {
    const last = new Date("2026-05-21T11:30:30Z").toISOString(); // 29분 30초 전
    // 60 - 29.5 = 30.5분 남음 → ceil = 31
    expect(computeCooldownRemaining(last, 60, now)).toBe(31);
  });

  it("정확히 쿨다운 경계는 0", () => {
    const last = new Date("2026-05-21T11:00:00Z").toISOString(); // 정확히 60분 전
    expect(computeCooldownRemaining(last, 60, now)).toBe(0);
  });
});
