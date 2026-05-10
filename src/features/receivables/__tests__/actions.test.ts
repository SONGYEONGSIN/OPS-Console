import { describe, it, expect } from "vitest";
import * as actions from "../actions";

describe("receivables actions — export 시그니처", () => {
  it("updateReceivablesCells는 async function", () => {
    expect(actions.updateReceivablesCells.constructor.name).toBe("AsyncFunction");
  });
});
