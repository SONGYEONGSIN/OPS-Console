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
 * pathname의 부모 컨테이너(group 또는 section)의 형제 메뉴들 (slug 있는 항목만, current 포함).
 * 매칭 실패 시 빈 배열.
 */
export function findSidebarSiblings(pathname: string): SiblingItem[] {
  for (const section of sidebarSections) {
    for (const entry of section.entries) {
      if (entry.kind === "item" && entry.slug && slugToHref(entry.slug) === pathname) {
        return section.entries
          .filter((e): e is Extract<typeof e, { kind: "item" }> => e.kind === "item")
          .filter((e) => e.slug)
          .map((e) => ({ ...e, href: slugToHref(e.slug!) }));
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
