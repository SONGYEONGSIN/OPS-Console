import { describe, it, expect } from "vitest";
import { summarizeChecks } from "../result";

describe("summarizeChecks", () => {
  it("pass/fail/total 집계 (skip은 total에만 포함)", () => {
    const summary = summarizeChecks([
      { key: "a", label: "A", status: "pass", message: null },
      { key: "b", label: "B", status: "fail", message: "에러" },
      { key: "c", label: "C", status: "skip", message: null },
    ]);
    expect(summary).toEqual({ pass: 1, fail: 1, total: 3 });
  });

  it("빈 배열 → 0/0/0", () => {
    expect(summarizeChecks([])).toEqual({ pass: 0, fail: 0, total: 0 });
  });
});
