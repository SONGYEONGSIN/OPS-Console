import { describe, it, expect } from "vitest";
import { canAct, STEP_ACTOR } from "../permission";
import type { Step, Role } from "../schemas";

/**
 * 4단계 × 2 role 매트릭스.
 * step별 actor: 1=팀원, 2=팀원, 3=관리자, 4=발행완료(누구도 X)
 */
const cases: Array<{ step: Step; role: Role; expected: boolean }> = [
  { step: 1, role: "evaluatee", expected: true },
  { step: 1, role: "evaluator", expected: false },
  { step: 2, role: "evaluatee", expected: true },
  { step: 2, role: "evaluator", expected: false },
  { step: 3, role: "evaluator", expected: true },
  { step: 3, role: "evaluatee", expected: false },
  { step: 4, role: "evaluator", expected: false },
  { step: 4, role: "evaluatee", expected: false },
];

describe("permission — canAct 4×2 매트릭스", () => {
  it.each(cases)(
    "step=$step / role=$role → $expected",
    ({ step, role, expected }) => {
      expect(canAct(step, role)).toBe(expected);
    },
  );

  it("STEP_ACTOR — 4 entries (4=null)", () => {
    expect(Object.keys(STEP_ACTOR)).toHaveLength(4);
    expect(STEP_ACTOR[4]).toBeNull();
  });

  it("step 1·2 = 팀원(evaluatee), step 3 = 관리자(evaluator)", () => {
    expect(STEP_ACTOR[1]).toBe("evaluatee");
    expect(STEP_ACTOR[2]).toBe("evaluatee");
    expect(STEP_ACTOR[3]).toBe("evaluator");
  });
});
