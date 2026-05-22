import { describe, it, expect } from "vitest";
import { parseScheduledAtKst } from "../schedule-time";

describe("parseScheduledAtKst", () => {
  it("KST datetime-local → UTC Date", () => {
    expect(parseScheduledAtKst("2026-05-25T14:30")?.toISOString()).toBe("2026-05-25T05:30:00.000Z");
  });
  it("초 포함 입력도 처리", () => {
    expect(parseScheduledAtKst("2026-05-25T14:30:00")?.toISOString()).toBe("2026-05-25T05:30:00.000Z");
  });
  it("빈 값/잘못된 값 → null", () => {
    expect(parseScheduledAtKst("")).toBeNull();
    expect(parseScheduledAtKst("nope")).toBeNull();
  });
});
