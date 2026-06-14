import { describe, it, expect } from "vitest";
import { canRevokeSend } from "../actions-guard";

describe("canRevokeSend", () => {
  it("sent만 되돌리기 가능", () => {
    expect(canRevokeSend("sent")).toBe(true);
    expect(canRevokeSend("draft")).toBe(false);
  });
});
