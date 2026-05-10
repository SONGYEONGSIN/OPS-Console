import { describe, it, expect } from "vitest";
import SchedulePage from "../page";

/**
 * async server component (currentOperator 룩업 의존). 시그니처만 보호.
 */
describe("SchedulePage — export 시그니처", () => {
  it("default export는 async function", () => {
    expect(typeof SchedulePage).toBe("function");
    expect(SchedulePage.constructor.name).toBe("AsyncFunction");
  });
});
