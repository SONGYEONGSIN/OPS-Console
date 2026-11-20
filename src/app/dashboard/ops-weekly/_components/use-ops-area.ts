"use client";

import { useCallback } from "react";
import { resolveArea, type AreaTab } from "../_params";
import { replaceOpsQuery, useOpsQueryValue } from "./use-ops-query";

/**
 * 왼쪽 영역 선택(`?tab=`)의 읽기·쓰기 한 곳. 영역을 바꾸면 하위 탭(`sub`)은 지운다 —
 * 영역마다 하위 탭 어휘가 달라 이전 영역의 값이 새 영역에 새면 안 된다.
 */
export function useOpsArea(): {
  area: AreaTab;
  setArea: (next: AreaTab, sub?: string | null) => void;
} {
  const area = resolveArea(useOpsQueryValue("tab"));
  const setArea = useCallback((next: AreaTab, sub?: string | null) => {
    replaceOpsQuery({ tab: next, sub: sub ?? null });
  }, []);
  return { area, setArea };
}
