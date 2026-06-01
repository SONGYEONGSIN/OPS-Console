import { describe, it, expect } from "vitest";
import { defaultApology } from "./apology";

describe("defaultApology", () => {
  it("대학명을 포함한 사과 본문을 생성한다", () => {
    const text = defaultApology("건국대학교");
    expect(text).toContain("건국대학교");
    expect(text).toContain("사과");
  });
});
