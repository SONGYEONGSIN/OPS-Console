import type { CurrentOperator } from "@/features/auth/queries";

/**
 * 일정 편집 권한 (순수 함수).
 * - admin: 모든 일정
 * - member: 본인이 created_by 또는 assignee인 일정만
 * - viewer / null: 차단
 *
 * actions.ts(use server)에 둘 수 없어 별도 모듈. 단위 테스트는 이 파일을 import.
 */
export function canEditScheduleEvent(
  target: { created_by_email: string; assignee_email: string | null },
  me: CurrentOperator | null,
): boolean {
  if (!me) return false;
  if (me.permission === "viewer" || me.permission === null) return false;
  if (me.permission === "admin") return true;
  if (target.created_by_email === me.email) return true;
  if (target.assignee_email && target.assignee_email === me.email) return true;
  return false;
}
