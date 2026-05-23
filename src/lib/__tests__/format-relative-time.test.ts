import { describe, it, expect } from "vitest";
import { formatRelativeTime } from "../format-relative-time";

const now = new Date("2026-05-23T12:00:00+09:00");

describe("formatRelativeTime", () => {
  it("30초 전 → 방금 전", () => {
    expect(formatRelativeTime(new Date("2026-05-23T11:59:30+09:00").toISOString(), now)).toBe("방금 전");
  });

  it("5분 전", () => {
    expect(formatRelativeTime(new Date("2026-05-23T11:55:00+09:00").toISOString(), now)).toBe("5분 전");
  });

  it("2시간 전", () => {
    expect(formatRelativeTime(new Date("2026-05-23T10:00:00+09:00").toISOString(), now)).toBe("2시간 전");
  });

  it("3일 전", () => {
    expect(formatRelativeTime(new Date("2026-05-20T12:00:00+09:00").toISOString(), now)).toBe("3일 전");
  });

  it("미래 시각 → 방금 전 (clamp 음수 방어)", () => {
    expect(formatRelativeTime(new Date("2026-05-23T12:05:00+09:00").toISOString(), now)).toBe("방금 전");
  });

  it("null/빈/잘못된 입력 → —", () => {
    expect(formatRelativeTime(null, now)).toBe("—");
    expect(formatRelativeTime("", now)).toBe("—");
    expect(formatRelativeTime("invalid", now)).toBe("—");
  });
});
