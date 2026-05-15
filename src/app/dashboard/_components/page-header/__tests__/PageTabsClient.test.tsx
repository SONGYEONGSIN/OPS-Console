import { describe, it, expect } from "vitest";
import { PageTabsClient } from "../PageTabsClient";

describe("PageTabsClient", () => {
  it("export 존재 + 컴포넌트 함수", () => {
    expect(typeof PageTabsClient).toBe("function");
  });
});
