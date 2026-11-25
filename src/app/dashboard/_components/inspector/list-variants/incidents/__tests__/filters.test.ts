import { afterEach, describe, expect, it, vi } from "vitest";
import { blankIncidentRow } from "../filters";

describe("blankIncidentRow 학년도 기본값", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("주입이 없으면 현 학년도 — 11월은 다음 해 학년도", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-25T12:00:00+09:00"));
    expect(blankIncidentRow().incidentYear).toBe(2027);
  });

  it("3월 전(2월)은 그 해 학년도", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-15T12:00:00+09:00"));
    expect(blankIncidentRow().incidentYear).toBe(2026);
  });
});
