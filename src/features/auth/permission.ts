import "server-only";
import { redirect } from "next/navigation";
import { getCurrentOperator, type CurrentOperator } from "./queries";
import type { OperatorPermission } from "@/features/operators/schemas";
import type { SbEntry, SbItem, SbSection } from "@/app/dashboard/_data";
import {
  ADMIN_ONLY_MENU_SLUGS,
  DESIGNATED_ONLY_MENU_SLUGS,
} from "@/app/dashboard/_data/sidebar-helpers";

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

/**
 * 사용자가 특정 메뉴(slug)를 볼 수 있는지.
 * - 비로그인(null) → false
 * - admin → 항상 true (bypass)
 * - admin 전용 메뉴(ADMIN_ONLY_MENU_SLUGS) → false
 * - 지정자 전용 메뉴(DESIGNATED_ONLY_MENU_SLUGS) → `operator.allowedMenus` 에 slug 가 있어야 true
 * - 그 외 → true (정책: deny 외 전체 허용, allowedMenus 는 보지 않는다)
 */
export function canViewMenu(
  slug: string,
  operator: CurrentOperator | null
): boolean {
  if (!operator) return false;
  if (operator.permission === "admin") return true;
  if (ADMIN_ONLY_MENU_SLUGS.has(slug)) return false;
  if (DESIGNATED_ONLY_MENU_SLUGS.has(slug)) {
    return operator.allowedMenus.includes(slug);
  }
  return true;
}

function canSeeItem(
  item: SbItem,
  operator: CurrentOperator | null
): boolean {
  if (item.adminOnly && operator?.permission !== "admin") return false;
  if (!item.slug) return true;
  return canViewMenu(item.slug, operator);
}

/**
 * 사이드바 섹션을 사용자 권한에 맞게 필터링.
 * - slug 없는 item(예: "실시간 현황")은 항상 통과
 * - slug 있는 item은 canViewMenu 통과한 것만 유지
 * - adminOnly item은 admin만 볼 수 있음
 * - group은 inner items 필터 후 길이>0이면 유지, 0이면 group 자체 hide
 */
export function filterSidebarSections(
  sections: SbSection[],
  operator: CurrentOperator | null
): SbSection[] {
  return sections.map((section) => ({
    ...section,
    entries: section.entries.flatMap<SbEntry>((entry) => {
      if (entry.kind === "item") {
        return canSeeItem(entry, operator) ? [entry] : [];
      }
      const items = entry.items.filter((it) => canSeeItem(it, operator));
      return items.length > 0 ? [{ ...entry, items }] : [];
    }),
  }));
}
