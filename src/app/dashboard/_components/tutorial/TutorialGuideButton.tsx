"use client";

import { useRouter } from "next/navigation";
import type { SbSection } from "../../_data";
import { buildMenuTutorialSteps } from "./build-menu-steps";
import { MENU_COPY } from "./tutorial-menu-copy";
import { runTour } from "./run-tour";

/**
 * 상단바 우측의 '가이드' 버튼 — 권한으로 보이는 메뉴별 상세 워크스루를 언제든 재생.
 * 화면 내용과 겹치지 않도록 chrome bar에 배치(과거 우하단 플로팅 버튼은 #318에서 겹침 이슈로 제거).
 * 메뉴 개요 스텝 진입 시 실제 그 메뉴로 이동(onNavigate).
 */
export function TutorialGuideButton({ sections }: { sections: SbSection[] }) {
  const router = useRouter();
  const onClick = () => {
    runTour(buildMenuTutorialSteps(sections, MENU_COPY), {
      doneBtnText: "완료",
      onNavigate: (slug) => router.push(`/dashboard/${slug}`),
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer border border-chrome-graphite/30 bg-transparent px-2.5 py-1 text-xs text-chrome-graphite transition-colors hover:border-vermilion hover:text-vermilion"
    >
      가이드
    </button>
  );
}
