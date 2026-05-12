import type { PageMetaConfig } from "./page-meta-config";
import { PAGE_META } from "./page-meta-config";
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

/**
 * PAGE_META의 explicit 정의를 우선하되, meta가 비어 있으면 derivePatternMeta로
 * 자동 채움. description도 동일 fallback.
 *
 * dynamicCount: DB 연동 페이지에서 실제 row 수를 전달하면 사이드바 hardcode
 * count를 덮어씀 (상단 메타와 본문 카운트 일치 보장).
 */
export function resolvePageMeta(
  slug: string,
  sidebarMeta: SbItem & { pattern: SbPattern },
  dynamicCount?: number,
): PageMetaConfig {
  const count =
    typeof dynamicCount === "number" ? String(dynamicCount) : sidebarMeta.count;
  const explicit = PAGE_META[slug];
  if (!explicit)
    return derivePageMeta(slug, { ...sidebarMeta, count });
  return {
    headline: explicit.headline,
    meta:
      explicit.meta ??
      derivePatternMeta(sidebarMeta.pattern, count),
    description:
      explicit.description ??
      derivePatternDescription(sidebarMeta.pattern, sidebarMeta.label),
  };
}

/**
 * KST 기준 현재 시각으로부터 시프트와 오늘 날짜를 derive.
 * - 06:00~14:00: '주간 I' / 14:00~22:00: '주간 II' / 그 외: '야간 III'
 * - 날짜: 'YYYY-MM-DD'
 */
function nowKR(): { shift: string; date: string } {
  const fmt = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const hour = Number(get("hour"));
  // 00:00~12:00 오전 / 12:00~24:00 오후
  const shift = hour < 12 ? "오전" : "오후";
  return { shift, date };
}

export function derivePatternMeta(
  pattern: SbPattern | undefined,
  count: string | undefined,
): MetaItem[] {
  const { shift, date } = nowKR();
  const base: MetaItem[] = [{ label: shift, tone: "accent" }, { label: date }];
  switch (pattern) {
    case "list":
      return [
        ...base,
        ...(count ? [{ label: `${count}건` }] : []),
      ];
    case "dash":
      return [
        ...base,
        ...(count ? [{ label: `위젯 ${count}개` }] : []),
        { label: "실시간 스트림" },
      ];
    case "project":
      return [...base, { label: "운영 진행" }];
    case "log":
      return [...base, { label: "로그 스트림" }];
    case "settings":
      return [...base, { label: "관리자 설정" }];
    default:
      return base;
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
