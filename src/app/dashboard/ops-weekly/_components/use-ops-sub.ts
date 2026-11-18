"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * 하위 탭 선택(`?sub=`)의 읽기·쓰기 한 곳.
 * 쓸 때는 `router.replace` 가 아니라 `history.replaceState` 다 — Next 는 이를 `useSearchParams` 와 동기화하므로
 * 서버 왕복·RSC 재요청이 없고 입력 중이던 폼이 그대로 남는다. replace 라 뒤로 가기가 탭마다 쌓이지 않는다.
 */
export function useOpsSub(): {
  raw: string | null;
  setSub: (key: string) => void;
} {
  const raw = useSearchParams()?.get("sub") ?? null;
  const setSub = useCallback((key: string) => {
    const qs = new URLSearchParams(window.location.search);
    qs.set("sub", key);
    window.history.replaceState(null, "", `${window.location.pathname}?${qs}`);
  }, []);
  return { raw, setSub };
}
