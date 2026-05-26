import { describe, it, expect } from "vitest";
import { parseScheduledAtKst } from "../schedule-time";

describe("parseScheduledAtKst", () => {
  it("KST datetime-local → UTC Date", () => {
    const d = parseScheduledAtKst("2026-12-01T10:00");
    expect(d).not.toBeNull();
    // KST 2026-12-01 10:00 = UTC 2026-12-01 01:00
    expect(d?.toISOString()).toBe("2026-12-01T01:00:00.000Z");
  });

  it("초 포함 입력도 정상 파싱", () => {
    const d = parseScheduledAtKst("2026-12-01T10:00:00");
    expect(d?.toISOString()).toBe("2026-12-01T01:00:00.000Z");
  });

  it("빈 문자열 → null", () => {
    expect(parseScheduledAtKst("")).toBeNull();
  });

  it("잘못된 형식 → null", () => {
    expect(parseScheduledAtKst("not-a-date")).toBeNull();
  });
});
