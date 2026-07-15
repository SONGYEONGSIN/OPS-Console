import { describe, it, expect } from "vitest";
import { DevControlSection } from "../DevControlSection";

describe("DevControlSection — export 시그니처", () => {
  it("named export는 async function (server component)", () => {
    expect(typeof DevControlSection).toBe("function");
    expect(DevControlSection.constructor.name).toBe("AsyncFunction");
  });
});
