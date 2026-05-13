import { describe, it, expect } from "vitest";
import BackupPage from "../page";

describe("BackupPage — export 시그니처", () => {
  it("default export는 async function", () => {
    expect(typeof BackupPage).toBe("function");
    expect(BackupPage.constructor.name).toBe("AsyncFunction");
  });
});
