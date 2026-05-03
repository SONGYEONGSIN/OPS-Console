import type { SbSection } from "../_data";

export type SearchItem = {
  slug: string;
  label: string;
  /** 상위 group 라벨 ("프로젝트", "서비스사이클" 등). 최상위 item이면 section 라벨. */
  group: string;
};

const MAX_RESULTS = 8;

/**
 * sidebarSections를 검색 가능한 flat list로 변환.
 * slug 없는 항목 (예: 실시간 현황)은 제외.
 */
export function buildSearchItems(sections: SbSection[]): SearchItem[] {
  const out: SearchItem[] = [];
  for (const section of sections) {
    for (const entry of section.entries) {
      if (entry.kind === "item") {
        if (entry.slug) {
          out.push({ slug: entry.slug, label: entry.label, group: section.title });
        }
      } else {
        for (const child of entry.items) {
          if (child.slug) {
            out.push({ slug: child.slug, label: child.label, group: entry.label });
          }
        }
      }
    }
  }
  return out;
}

/**
 * 부분 매치 (대소문자 무시, 공백 trim). 빈 쿼리는 빈 배열.
 * 결과는 최대 MAX_RESULTS개로 제한.
 */
export function filterItems(items: SearchItem[], query: string): SearchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: SearchItem[] = [];
  for (const item of items) {
    if (
      item.label.toLowerCase().includes(q) ||
      item.slug.toLowerCase().includes(q) ||
      item.group.toLowerCase().includes(q)
    ) {
      out.push(item);
      if (out.length >= MAX_RESULTS) break;
    }
  }
  return out;
}
