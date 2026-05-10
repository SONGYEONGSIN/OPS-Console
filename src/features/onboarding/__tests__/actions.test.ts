import { describe, it, expect } from "vitest";
import * as actions from "../actions";

describe("onboarding actions — export 시그니처", () => {
  it("create / update / delete 모두 async 함수", () => {
    expect(actions.createCohort.constructor.name).toBe("AsyncFunction");
    expect(actions.updateCohort.constructor.name).toBe("AsyncFunction");
    expect(actions.deleteCohort.constructor.name).toBe("AsyncFunction");
  });
});
