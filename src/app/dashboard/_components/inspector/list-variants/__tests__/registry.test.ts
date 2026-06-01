import { describe, it, expect } from "vitest";
import { variantRegistry } from "../registry";

describe("variantRegistry", () => {
  it("backup variant 등록됨 (View / EditForm / Table / Filters / blank)", () => {
    const entry = variantRegistry.backup;
    expect(entry).toBeDefined();
    expect(entry.View).toBeDefined();
    expect(entry.EditForm).toBeDefined();
    expect(entry.Table).toBeDefined();
    expect(entry.Filters).toBeDefined();
    expect(entry.blank).toBeDefined();
  });

  it("최소 10개 variant 등록 확인 (기존 9 + backup)", () => {
    expect(Object.keys(variantRegistry).length).toBeGreaterThanOrEqual(10);
  });

  it("incident-reports variant 등록됨 (View / EditForm / Table / Filters / blank)", () => {
    const entry = variantRegistry["incident-reports"];
    expect(entry).toBeDefined();
    expect(entry.View).toBeDefined();
    expect(entry.EditForm).toBeDefined();
    expect(entry.Table).toBeDefined();
    expect(entry.Filters).toBeDefined();
    expect(entry.blank).toBeDefined();
  });
});
