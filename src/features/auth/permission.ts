import "server-only";
import { redirect } from "next/navigation";
import { getCurrentOperator, type CurrentOperator } from "./queries";
import type { OperatorPermission } from "@/features/operators/schemas";
import type { SbEntry, SbItem, SbSection } from "@/app/dashboard/_data";
import { ADMIN_ONLY_MENU_SLUGS } from "@/app/dashboard/_data/sidebar-helpers";

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
 * - 그 외(member/viewer) → ADMIN_ONLY_MENU_SLUGS 외 모두 true (정책: deny 외 전체 허용)
 *
 * 과거에는 `operator.allowedMenus` 멤버십을 체크했지만, 운영 정책상 admin 전용 메뉴
 * 5개(조직권한·시스템설정·공지사항·성과리포트·자동화 실행) 외에는 모든 멤버가 자유롭게
 * 접근하는 것으로 일원화. allowedMenus 필드는 schema에 유지되나 현재 미사용.
 */
export function canViewMenu(
  slug: string,
  operator: CurrentOperator | null
): boolean {
  if (!operator) return false;
  if (operator.permission === "admin") return true;
  return !ADMIN_ONLY_MENU_SLUGS.has(slug);
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
