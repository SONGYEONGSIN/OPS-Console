// 권한으로 필터된 사이드바 sections를 소비해 메뉴(slug)별 튜토리얼 스텝을 생성한다.
// 순수 함수 — RSC/DOM 무관, 데이터 변환만. 사전(MENU_COPY)에 없는 slug는 건너뛴다(폴백 금지).

import type { SbSection, SbItem } from "../../_data";
import type { TutorialStep } from "./tutorial-steps";
import type { MenuCopy } from "./tutorial-menu-copy";

/** 평탄화된 메뉴 항목 — 그룹 안에 있었는지(inGroup) 함께 보관. */
type FlatMenuItem = { item: SbItem; inGroup: boolean };

/** sections(권한 필터됨)를 평탄화해 slug 있는 메뉴 항목만 사이드바 순서대로 추출. */
function flattenMenuItems(sections: SbSection[]): FlatMenuItem[] {
  const items: FlatMenuItem[] = [];
  for (const section of sections) {
    for (const entry of section.entries) {
      if (entry.kind === "item") {
        if (entry.slug) items.push({ item: entry, inGroup: false });
      } else {
        for (const sub of entry.items) {
          if (sub.slug) items.push({ item: sub, inGroup: true });
        }
      }
    }
  }
  return items;
}

/**
 * 한 메뉴의 스텝(개요·인터랙션·버튼) 생성. 버튼 콘텐츠가 없으면 버튼 스텝 생략.
 * 그룹 안 메뉴는 접혀 있으면 DOM에 항목이 없으므로 개요 스텝을 앵커 없이(중앙) 안내한다.
 */
function menuSteps(
  item: SbItem,
  copy: MenuCopy,
  inGroup: boolean,
): TutorialStep[] {
  const label = item.label;
  const steps: TutorialStep[] = [
    {
      element: inGroup ? undefined : `[data-tutorial-slug='${item.slug}']`,
      title: label,
      description: copy.overview,
    },
    {
      element: "[data-tutorial='content']",
      title: `${label} — 목록과 인스펙터`,
      description: copy.interaction,
    },
  ];
  if (copy.buttons.length > 0) {
    steps.push({
      title: `${label} — 주요 버튼`,
      description: copy.buttons
        .map((b) => `• ${b.label} — ${b.desc}`)
        .join("\n"),
    });
  }
  return steps;
}

/**
 * 권한으로 보이는 메뉴 각각에 대해 사전(copy) 콘텐츠로 스텝을 생성한다.
 * - slug 없는 항목(예: 실시간 현황) 제외
 * - 사전에 없는 slug 제외(스텝 0개)
 * - 사이드바 등장 순서 유지
 */
export function buildMenuTutorialSteps(
  sections: SbSection[],
  copy: Record<string, MenuCopy>,
): TutorialStep[] {
  return flattenMenuItems(sections).flatMap(({ item, inGroup }) => {
    const c = copy[item.slug!];
    return c ? menuSteps(item, c, inGroup) : [];
  });
}
