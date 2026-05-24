import type { Step, Role } from "./schemas";

/**
 * 8단계 평가 워크플로우의 단계별 actor.
 * - 1=목표설정(평가자), 2=실행계획(팀원), 3=계획검토(평가자), 4=중간점검(팀원),
 *   5=점검검토(평가자), 6=자기평가(팀원), 7=종합평가(평가자), 8=완료(누구도 X).
 */
export const STEP_ACTOR: Record<Step, Role | null> = {
  1: "evaluator",
  2: "evaluatee",
  3: "evaluator",
  4: "evaluatee",
  5: "evaluator",
  6: "evaluatee",
  7: "evaluator",
  8: null,
};

/**
 * 현재 단계에서 주어진 role이 액션 가능한지 (UI 잠금용).
 * 진짜 가드는 RLS + server actions에서 이중화 — 이 함수는 FE 표시 보조.
 */
export function canAct(step: Step, role: Role): boolean {
  return STEP_ACTOR[step] === role;
}
