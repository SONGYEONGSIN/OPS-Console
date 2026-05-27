import { describe, it, expect } from "vitest";
import { register } from "../instrumentation";

describe("instrumentation", () => {
  it("register는 callable", () => {
    expect(typeof register).toBe("function");
  });
});
