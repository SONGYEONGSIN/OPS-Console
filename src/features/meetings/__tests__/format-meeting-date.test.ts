import { describe, it, expect } from "vitest";
import { formatMeetingDateKst } from "../format-meeting-date";

describe("formatMeetingDateKst", () => {
  it("UTC ISO를 KST로 변환 표기 (UTC 06:00 → KST 15:00)", () => {
    expect(formatMeetingDateKst("2026-06-25T06:00:00+00:00")).toBe(
      "2026. 06. 25. 15:00",
    );
  });

  it("자정 경계 — UTC 16:00 → 다음날 KST 01:00", () => {
    expect(formatMeetingDateKst("2026-06-25T16:00:00+00:00")).toBe(
      "2026. 06. 26. 01:00",
    );
  });

  it("null/빈값 → '—'", () => {
    expect(formatMeetingDateKst(null)).toBe("—");
    expect(formatMeetingDateKst("")).toBe("—");
    expect(formatMeetingDateKst(undefined)).toBe("—");
  });

  it("파싱 불가 → 원본 그대로", () => {
    expect(formatMeetingDateKst("미정")).toBe("미정");
  });
});
