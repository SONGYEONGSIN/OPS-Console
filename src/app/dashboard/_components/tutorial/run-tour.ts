// driver.js 투어 실행 공유 헬퍼 — 전역 인트로(TutorialTour)와 메뉴 가이드(TutorialGuideButton) 공용.
// 스텝이 0개면 아무것도 하지 않는다(빈 투어 방지).

import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import type { TutorialStep } from "./tutorial-steps";

export function runTour(
  steps: TutorialStep[],
  opts?: { doneBtnText?: string; onDestroyed?: () => void },
): void {
  if (steps.length === 0) return;
  const tour = driver({
    showProgress: true,
    progressText: "{{current}} / {{total}}",
    nextBtnText: "다음",
    prevBtnText: "이전",
    doneBtnText: opts?.doneBtnText ?? "완료",
    steps: steps.map((s) => ({
      element: s.element,
      popover: { title: s.title, description: s.description },
    })),
    onDestroyed: opts?.onDestroyed,
  });
  tour.drive();
}
