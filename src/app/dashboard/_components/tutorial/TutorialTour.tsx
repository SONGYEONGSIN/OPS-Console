"use client";

import { useCallback, useEffect, useRef } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import {
  TUTORIAL_STEPS,
  hasTutorialSeen,
  markTutorialSeen,
} from "./tutorial-steps";

/**
 * 첫 방문 가이드 투어 (driver.js).
 * - 미열람 시 마운트 후 자동 1회 실행 (영역별 스포트라이트)
 * - 종료(완료/건너뛰기/닫기) 시 열람 처리
 * - 우하단 '도움말' 버튼으로 언제든 재실행
 */
export function TutorialTour() {
  const startedRef = useRef(false);

  const start = useCallback(() => {
    const tour = driver({
      showProgress: true,
      progressText: "{{current}} / {{total}}",
      nextBtnText: "다음",
      prevBtnText: "이전",
      doneBtnText: "시작하기",
      steps: TUTORIAL_STEPS.map((s) => ({
        element: s.element,
        popover: { title: s.title, description: s.description },
      })),
      onDestroyed: () => markTutorialSeen(),
    });
    tour.drive();
  }, []);

  // 첫 방문이면 마운트 후 자동 실행 (열람 여부는 client localStorage 기준)
  useEffect(() => {
    if (startedRef.current) return;
    if (!hasTutorialSeen()) {
      startedRef.current = true;
      start();
    }
  }, [start]);

  return (
    <button
      type="button"
      data-tutorial="help"
      onClick={start}
      className="fixed bottom-4 right-4 z-40 border border-line bg-washi-raised px-3 py-1.5 text-xs text-ink shadow-sm hover:bg-washi"
    >
      도움말
    </button>
  );
}
