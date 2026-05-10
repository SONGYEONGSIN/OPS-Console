import { describe, it, expect } from "vitest";
import NoticesPage from "../page";

/**
 * async server component (currentOperator 룩업 의존). 시그니처만 보호.
 */
describe("NoticesPage — export 시그니처", () => {
  it("default export는 async function", () => {
    expect(typeof NoticesPage).toBe("function");
    expect(NoticesPage.constructor.name).toBe("AsyncFunction");
  });
});
