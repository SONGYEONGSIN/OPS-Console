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
 * slug에 매칭되는 메뉴 label 반환. group 내부 items 포함.
 * 매칭 실패 시 slug 그대로 반환. (브라우저 타이틀·nav 로깅에서 메뉴명 표시에 사용)
 */
export function findSidebarLabel(sections: SbSection[], slug: string): string {
  for (const section of sections) {
    for (const entry of section.entries) {
      if (entry.kind === "item" && entry.slug === slug) return entry.label;
      if (entry.kind === "group") {
        for (const child of entry.items) {
          if (child.slug === slug) return child.label;
        }
      }
    }
  }
  return slug;
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
 * admin 전용 메뉴 slug 집합 — 비-admin(member/viewer)은 사이드바·페이지 진입 모두 차단.
 * 사이드바 정의의 `adminOnly: true`와 동기 (single source of truth는 _data.ts지만,
 * canViewMenu에서 fast lookup을 위해 별도 set으로 운영).
 */
export const ADMIN_ONLY_MENU_SLUGS = new Set([
  "notices",
  "team",
  "settings",
  "outcomes",
  "automations",
]);

/** 신규 member 생성 시 기본 allowed_menus — admin 전용 메뉴를 제외한 전체. */
export function getDefaultMemberMenus(): string[] {
  return getAllMenuSlugs().filter((s) => !ADMIN_ONLY_MENU_SLUGS.has(s));
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
