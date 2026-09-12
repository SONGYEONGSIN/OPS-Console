import { describe, it, expect } from "vitest";
import type { Variant } from "../types";

describe("Variant union", () => {
  it("backup variant 포함", () => {
    const v: Variant = "backup";
    expect(v).toBe("backup");
  });

  it("ai-tip-candidates variant 포함", () => {
    const v: Variant = "ai-tip-candidates";
    expect(v).toBe("ai-tip-candidates");
  });

  it("기존 variant 호환 (ai-work)", () => {
    const v: Variant = "ai-work";
    expect(v).toBe("ai-work");
  });
});
