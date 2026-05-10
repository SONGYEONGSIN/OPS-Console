import { describe, it, expect } from "vitest";
import CohortDetailPage from "../page";

describe("CohortDetailPage — export 시그니처", () => {
  it("default export는 async function", () => {
    expect(typeof CohortDetailPage).toBe("function");
    expect(CohortDetailPage.constructor.name).toBe("AsyncFunction");
  });
});
