import { describe, it, expect } from "vitest";
import { STATUS_TONE } from "./status";
import { REPORT_STATUS_VALUES } from "@/features/incident-reports/schemas";

describe("STATUS_TONE", () => {
  it("5개 결재 상태 키를 모두 보유한다", () => {
    expect(Object.keys(STATUS_TONE).sort()).toEqual(
      [...REPORT_STATUS_VALUES].sort(),
    );
  });

  it("모든 값은 비어있지 않은 문자열이다", () => {
    for (const value of Object.values(STATUS_TONE)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
