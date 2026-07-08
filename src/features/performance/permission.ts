import type { Step, Role } from "./schemas";

/**
 * 4단계 관리자 중심 워크플로우의 단계별 actor.
 * - 1=목표설정(팀원), 2=실행계획·성과지표(팀원), 3=정량집계·관리자평가(관리자), 4=발행완료(X).
 */
export const STEP_ACTOR: Record<Step, Role | null> = {
  1: "evaluatee",
  2: "evaluatee",
  3: "evaluator",
  4: null,
};

/**
 * 현재 단계에서 주어진 role이 액션 가능한지 (UI 잠금용).
 * 진짜 가드는 RLS + server actions에서 이중화 — 이 함수는 FE 표시 보조.
 */
export function canAct(step: Step, role: Role): boolean {
  return STEP_ACTOR[step] === role;
}
