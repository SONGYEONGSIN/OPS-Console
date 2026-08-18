import { ADMIN_ONLY_MENU_SLUGS } from "@/app/dashboard/_data/sidebar-helpers";
import type { OperatorPermission } from "@/features/operators/schemas";
import type { SourceDomain } from "./search";

/**
 * 검색 도메인 ↔ 사이드바 메뉴 slug.
 *
 * 권한은 **행이 아니라 메뉴**에서 갈린다 — 7개 테이블의 RLS가 전부
 * `for select to authenticated using (true)`라 로그인한 운영자는 어차피 모든 행을
 * 읽는다(2026-08-18 확인). 그래서 도메인 단위로 메뉴 권한을 본다.
 *
 * 이 매핑이 틀리면 조용히 통과한다 — `canViewMenu`가 admin 전용 목록에 없는 slug를
 * 전부 허용하기 때문이다. `__tests__/domain-menu.test.ts`가 slug 실재를 검사한다.
 */
export const DOMAIN_MENU_SLUG: Record<SourceDomain, string> = {
  incident: "incidents",
  handover: "handover",
  "ai-tip": "ai-tips",
  backup: "backup",
  contact: "contacts",
  service: "services",
  knowledge: "knowledge",
};

/**
 * 이 권한으로 검색 결과에 실을 수 있는 도메인.
 *
 * viewer는 빈 배열이다 — 어시스턴트 자체가 viewer 403이므로 도구도 같은 선을 지킨다.
 * 여기서 한 겹 더 막는 이유는, 도구가 큐를 통해 불리므로 화면 가드를 안 거치기 때문이다.
 */
export function visibleDomains(
  permission: OperatorPermission | null,
): SourceDomain[] {
  if (!permission || permission === "viewer") return [];
  const all = Object.keys(DOMAIN_MENU_SLUG) as SourceDomain[];
  if (permission === "admin") return all;
  return all.filter((d) => !ADMIN_ONLY_MENU_SLUGS.has(DOMAIN_MENU_SLUG[d]));
}
