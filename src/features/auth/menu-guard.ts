import "server-only";
import { redirect } from "next/navigation";
import { getCurrentOperator, type CurrentOperator } from "./queries";
import { canViewMenu } from "./permission";

/**
 * RSC 페이지 진입 가드 — 사용자가 해당 slug의 메뉴를 볼 수 있는지 강제.
 * - 비로그인 → /login
 * - admin은 항상 통과 (canViewMenu 내부 bypass)
 * - 권한 없는 사용자 → /dashboard (read 가능한 fallback)
 */
export async function requireMenu(slug: string): Promise<CurrentOperator> {
  const me = await getCurrentOperator();
  if (!me) {
    redirect("/login");
  }
  if (!canViewMenu(slug, me)) {
    redirect("/dashboard");
  }
  return me;
}
