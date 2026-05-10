import { describe, it, expect } from "vitest";
import FeedbackPage from "../page";

/**
 * server component (RSC) — 동작 검증은 매뉴얼/E2E. 시그니처만 보호.
 */
describe("FeedbackPage — export 시그니처", () => {
  it("default export는 function", () => {
    expect(typeof FeedbackPage).toBe("function");
  });
});
