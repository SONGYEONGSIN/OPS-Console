import { describe, it, expect } from "vitest";
import OnboardingPage from "../page";

describe("OnboardingPage — export 시그니처", () => {
  it("default export는 async function", () => {
    expect(typeof OnboardingPage).toBe("function");
    expect(OnboardingPage.constructor.name).toBe("AsyncFunction");
  });
});
