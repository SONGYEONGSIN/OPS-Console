import { describe, it, expect } from "vitest";
import ReceivablesPage from "../page";

describe("ReceivablesPage — export 시그니처", () => {
  it("default export는 async function", () => {
    expect(typeof ReceivablesPage).toBe("function");
    expect(ReceivablesPage.constructor.name).toBe("AsyncFunction");
  });
});
