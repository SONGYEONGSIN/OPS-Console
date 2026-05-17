import { sidebarSections, type SbItem, type SbSection } from "../_data";

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

/**
 * 사이드바 sections의 count를 실 데이터 count로 교체.
 * - item.slug가 counts map에 있으면 동적 카운트 적용
 * - group의 count는 자식 슬러그 sum으로 자동 계산 (counts map에 있는 것만 합산)
 * - 미구현 도메인은 빈 칸 유지 (DB 테이블 만들고 menu-counts/queries.ts에 등록하면 자동 적용)
 */
export function applyDynamicSidebarCounts(
  sections: SbSection[],
  counts: Map<string, number>,
): SbSection[] {
  const replaceItemCount = <T extends SbItem>(item: T): T => {
    if (!item.slug) return item;
    const c = counts.get(item.slug);
    return c === undefined ? item : { ...item, count: String(c) };
  };

  return sections.map((section) => ({
    ...section,
    entries: section.entries.map((entry) => {
      if (entry.kind === "item") return replaceItemCount(entry);
      const items = entry.items.map(replaceItemCount);
      // group count = 자식 중 DB-연동된 slug count의 합 (counts map에 있는 것만)
      const childSums = items
        .map((it) => (it.slug ? counts.get(it.slug) : undefined))
        .filter((v): v is number => v !== undefined);
      const groupCount = childSums.length > 0
        ? String(childSums.reduce((a, b) => a + b, 0))
        : "";
      return { ...entry, items, count: groupCount };
    }),
  }));
}
