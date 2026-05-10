import "server-only";
import { redirect } from "next/navigation";
import { getCurrentOperator, type CurrentOperator } from "./queries";
import type { OperatorPermission } from "@/features/operators/schemas";
import type { SbEntry, SbSection } from "@/app/dashboard/_data";

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
 * admin은 항상 통과(bypass), 그 외엔 allowedMenus 멤버십 체크.
 * 비로그인(null) → false.
 */
export function canViewMenu(
  slug: string,
  operator: CurrentOperator | null
): boolean {
  if (!operator) return false;
  if (operator.permission === "admin") return true;
  return operator.allowedMenus.includes(slug);
}

/**
 * 사이드바 섹션을 사용자 권한에 맞게 필터링.
 * - slug 없는 item(예: "실시간 현황")은 항상 통과
 * - slug 있는 item은 canViewMenu 통과한 것만 유지
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
        if (!entry.slug) return [entry];
        return canViewMenu(entry.slug, operator) ? [entry] : [];
      }
      const items = entry.items.filter(
        (it) => !it.slug || canViewMenu(it.slug, operator)
      );
      return items.length > 0 ? [{ ...entry, items }] : [];
    }),
  }));
}
