import { describe, it, expect } from "vitest";
import { MEETING_STATUS_TONE } from "./status";
import { MEETING_STATUSES } from "@/features/meetings/schemas";

describe("MEETING_STATUS_TONE", () => {
  it("draft/sent 상태 키를 모두 보유한다", () => {
    expect(Object.keys(MEETING_STATUS_TONE).sort()).toEqual(
      [...MEETING_STATUSES].sort(),
    );
  });

  it("모든 값은 비어있지 않은 문자열이다", () => {
    for (const value of Object.values(MEETING_STATUS_TONE)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
