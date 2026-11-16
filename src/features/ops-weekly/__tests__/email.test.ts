import { describe, it, expect } from "vitest";
import { normEmail } from "../email";

describe("normEmail", () => {
  it("앞뒤 공백을 지우고 소문자로 만든다", () => {
    expect(normEmail("  A@Example.COM ")).toBe("a@example.com");
  });
});
