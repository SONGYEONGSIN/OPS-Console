"use client";

import { useEffect, useRef } from "react";
import {
  INTRO_STEPS,
  hasTutorialSeen,
  markTutorialSeen,
} from "./tutorial-steps";
import { runTour } from "./run-tour";

/**
 * 첫 방문 가이드 투어 (driver.js).
 * - 미열람 시 마운트 후 자동 1회 실행 (영역별 스포트라이트)
 * - 종료(완료/건너뛰기/닫기) 시 열람 처리
 * - UI 렌더 없음(effect 전용). 메뉴별 재생은 상단바 '가이드' 버튼(TutorialGuideButton).
 */
export function TutorialTour() {
  const startedRef = useRef(false);

  // 첫 방문이면 마운트 후 자동 실행 (열람 여부는 client localStorage 기준)
  useEffect(() => {
    if (startedRef.current) return;
    if (!hasTutorialSeen()) {
      startedRef.current = true;
      runTour(INTRO_STEPS, {
        doneBtnText: "시작하기",
        onDestroyed: markTutorialSeen,
      });
    }
  }, []);

  return null;
}
