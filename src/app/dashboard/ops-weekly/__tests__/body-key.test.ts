import { describe, it, expect } from "vitest";
import { bodyKeyOf } from "../_body-key";

describe("bodyKeyOf", () => {
  it("보고서가 있으면 보고서 id 와 탭이 키다", () => {
    expect(
      bodyKeyOf({ reportId: "r1", weekStart: "w", op: "a", tab: "pims" }),
    ).toBe("r1:pims");
    expect(
      bodyKeyOf({ reportId: "r2", weekStart: "w", op: "a", tab: "pims" }),
    ).not.toBe(
      bodyKeyOf({ reportId: "r1", weekStart: "w", op: "a", tab: "pims" }),
    );
  });
  it("보고서가 없으면 주·운영자·탭이 키다", () => {
    const a = bodyKeyOf({
      reportId: null,
      weekStart: "2026-11-16",
      op: "a@example.com",
      tab: "leave",
    });
    const b = bodyKeyOf({
      reportId: null,
      weekStart: "2026-11-16",
      op: "b@example.com",
      tab: "leave",
    });
    const c = bodyKeyOf({
      reportId: null,
      weekStart: "2026-11-09",
      op: "a@example.com",
      tab: "leave",
    });
    expect(new Set([a, b, c]).size).toBe(3);
  });
});
