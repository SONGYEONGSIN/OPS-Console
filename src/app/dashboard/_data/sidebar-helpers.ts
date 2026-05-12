import { sidebarSections, type SbItem } from "../_data";

export type BreadcrumbCrumb = { label: string };

type SiblingItem = SbItem & { href: string };

function slugToHref(slug: string): string {
  return `/dashboard/${slug}`;
}

/**
 * pathname에 매칭되는 메뉴까지의 경로(section → group? → item)를 root → leaf 순으로 반환.
 * 매칭 실패 시 빈 배열.
 */
export function findSidebarBreadcrumb(pathname: string): BreadcrumbCrumb[] {
  for (const section of sidebarSections) {
    for (const entry of section.entries) {
      if (entry.kind === "item" && entry.slug && slugToHref(entry.slug) === pathname) {
        return [{ label: section.title }, { label: entry.label }];
      }
      if (entry.kind === "group") {
        for (const child of entry.items) {
          if (child.slug && slugToHref(child.slug) === pathname) {
            return [
              { label: section.title },
              { label: entry.label },
              { label: child.label },
            ];
          }
        }
      }
    }
  }
  return [];
}

/**
 * pathname의 부모 group 안 children (slug 있는 항목, current 포함).
 * section 직속 item이면 형제 탭 미노출 의도라 빈 배열 반환.
 * 매칭 실패도 빈 배열.
 */
export function findSidebarSiblings(pathname: string): SiblingItem[] {
  for (const section of sidebarSections) {
    for (const entry of section.entries) {
      if (entry.kind === "item" && entry.slug && slugToHref(entry.slug) === pathname) {
        // section 직속 item — 형제 탭 미노출
        return [];
      }
      if (entry.kind === "group") {
        const hit = entry.items.some(
          (c) => c.slug && slugToHref(c.slug) === pathname,
        );
        if (hit) {
          return entry.items
            .filter((c) => c.slug)
            .map((c) => ({ ...c, href: slugToHref(c.slug!) }));
        }
      }
    }
  }
  return [];
}

/**
 * pathname의 부모 group label 반환 (group 안 item만).
 * section 직속 item이거나 매칭 실패 시 null.
 */
export function findSidebarParentGroup(pathname: string): string | null {
  for (const section of sidebarSections) {
    for (const entry of section.entries) {
      if (entry.kind === "group") {
        const hit = entry.items.some(
          (c) => c.slug && slugToHref(c.slug) === pathname,
        );
        if (hit) return entry.label;
      }
    }
  }
  return null;
}

/**
 * 사이드바에 등록된 모든 메뉴 slug 평탄화 반환. group 내부 items 포함.
 */
export function getAllMenuSlugs(): string[] {
  const slugs: string[] = [];
  for (const section of sidebarSections) {
    for (const entry of section.entries) {
      if (entry.kind === "item") {
        if (entry.slug) slugs.push(entry.slug);
      } else {
        for (const item of entry.items) {
          if (item.slug) slugs.push(item.slug);
        }
      }
    }
  }
  return slugs;
}

/**
 * member 권한 기본 허용 메뉴 — 공지사항·조직 권한·시스템 설정만 제외하고 전체.
 */
const MEMBER_DENY_SLUGS = new Set(["notices", "team", "settings"]);
export function getDefaultMemberMenus(): string[] {
  return getAllMenuSlugs().filter((s) => !MEMBER_DENY_SLUGS.has(s));
}
