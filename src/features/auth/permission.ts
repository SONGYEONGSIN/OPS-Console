import "server-only";
import { redirect } from "next/navigation";
import { getCurrentOperator, type CurrentOperator } from "./queries";
import type { OperatorPermission } from "@/features/operators/schemas";

/**
 * RSC/server action에서 admin 권한 강제.
 * - 비로그인 → /login
 * - admin 외(member/viewer/null) → /dashboard (read 허용 페이지로 fallback)
 */
export async function requireAdmin(): Promise<CurrentOperator> {
  const me = await getCurrentOperator();
  if (!me) {
    redirect("/login");
  }
  if (me.permission !== "admin") {
    redirect("/dashboard");
  }
  return me;
}

/**
 * 클라이언트/서버 양쪽에서 사용 가능한 순수 함수.
 * operators 도메인 편집(생성/수정/삭제) 가능 여부.
 */
export function canEditOperators(
  permission: OperatorPermission | null
): boolean {
  return permission === "admin";
}
