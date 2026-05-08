import type { PageMetaConfig } from "./page-meta-config";
import type { MetaItem } from "../_components/page-header/PageMeta";
import type { SbItem, SbPattern } from "../_data";
import { findSidebarBreadcrumb } from "./sidebar-helpers";

/**
 * PAGE_META에 명시되지 않은 slug에 대해 sidebar 데이터 + 패턴별 기본값으로
 * PageMetaConfig 자동 생성.
 */
export function derivePageMeta(
  slug: string,
  sidebarMeta: SbItem,
): PageMetaConfig {
  const breadcrumb = findSidebarBreadcrumb(`/dashboard/${slug}`);
  const accent =
    breadcrumb.length >= 2
      ? breadcrumb[breadcrumb.length - 2].label
      : undefined;
  const title = sidebarMeta.label;
  const meta = derivePatternMeta(sidebarMeta.pattern, sidebarMeta.count);
  const description = derivePatternDescription(sidebarMeta.pattern, title);
  return { headline: { accent, title }, meta, description };
}

function derivePatternMeta(
  pattern: SbPattern | undefined,
  count: string | undefined,
): MetaItem[] {
  switch (pattern) {
    case "list":
      return count ? [{ label: "전체", value: `${count}건` }] : [];
    case "dash":
      return count ? [{ label: "위젯", value: `${count}개` }] : [];
    case "project":
      return [{ label: "운영", tone: "accent" }];
    case "log":
      return [{ label: "로그", value: "stream" }];
    case "settings":
      return [];
    default:
      return [];
  }
}

function derivePatternDescription(
  pattern: SbPattern | undefined,
  title: string,
): string {
  switch (pattern) {
    case "list":
      return `${title} 목록입니다. 항목 선택 시 인스펙터에서 상세를 확인하고 편집할 수 있습니다.`;
    case "dash":
      return `${title} 위젯을 시간순으로 표시합니다.`;
    case "project":
      return `${title} 프로젝트 진행 정보.`;
    case "log":
      return `${title} 로그 스트림.`;
    case "settings":
      return `${title} 설정 패널.`;
    default:
      return `${title}.`;
  }
}
