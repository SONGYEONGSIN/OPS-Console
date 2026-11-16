import { describe, it, expect } from "vitest";
import { formatMdDow, formatMdHm } from "../_format";

describe("format", () => {
  it("M/D HH:mm · M/D(요일) — KST 24시간제", () => {
    expect(formatMdHm("2026-11-19T15:30:00Z")).toBe("11/20 00:30");
    expect(formatMdDow("2026-11-18")).toBe("11/18(수)");
  });

  it("오후 표기 없이 24시간제, 자정은 00", () => {
    expect(formatMdHm("2026-11-19T08:05:00Z")).toBe("11/19 17:05");
    expect(formatMdHm("2026-11-19T15:00:00Z")).toBe("11/20 00:00");
  });
});
