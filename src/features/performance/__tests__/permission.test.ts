import { describe, it, expect } from "vitest";
import { canAct, STEP_ACTOR } from "../permission";
import type { Step, Role } from "../schemas";

/**
 * 8단계 × 2 role = 16 케이스 매트릭스.
 * step별 actor:
 *  1=평가자, 2=팀원, 3=평가자, 4=팀원, 5=평가자, 6=팀원, 7=평가자, 8=완료(누구도 X)
 */
const cases: Array<{ step: Step; role: Role; expected: boolean }> = [
  { step: 1, role: "evaluator", expected: true },
  { step: 1, role: "evaluatee", expected: false },
  { step: 2, role: "evaluator", expected: false },
  { step: 2, role: "evaluatee", expected: true },
  { step: 3, role: "evaluator", expected: true },
  { step: 3, role: "evaluatee", expected: false },
  { step: 4, role: "evaluator", expected: false },
  { step: 4, role: "evaluatee", expected: true },
  { step: 5, role: "evaluator", expected: true },
  { step: 5, role: "evaluatee", expected: false },
  { step: 6, role: "evaluator", expected: false },
  { step: 6, role: "evaluatee", expected: true },
  { step: 7, role: "evaluator", expected: true },
  { step: 7, role: "evaluatee", expected: false },
  { step: 8, role: "evaluator", expected: false },
  { step: 8, role: "evaluatee", expected: false },
];

describe("permission — canAct 8×2 매트릭스", () => {
  it.each(cases)("step=$step / role=$role → $expected", ({ step, role, expected }) => {
    expect(canAct(step, role)).toBe(expected);
  });

  it("STEP_ACTOR — 8 entries (8=null)", () => {
    expect(Object.keys(STEP_ACTOR)).toHaveLength(8);
    expect(STEP_ACTOR[8]).toBeNull();
  });

  it("STEP_ACTOR — 홀수 step(1,3,5,7) = evaluator", () => {
    expect(STEP_ACTOR[1]).toBe("evaluator");
    expect(STEP_ACTOR[3]).toBe("evaluator");
    expect(STEP_ACTOR[5]).toBe("evaluator");
    expect(STEP_ACTOR[7]).toBe("evaluator");
  });

  it("STEP_ACTOR — 짝수 step(2,4,6) = evaluatee", () => {
    expect(STEP_ACTOR[2]).toBe("evaluatee");
    expect(STEP_ACTOR[4]).toBe("evaluatee");
    expect(STEP_ACTOR[6]).toBe("evaluatee");
  });
});
