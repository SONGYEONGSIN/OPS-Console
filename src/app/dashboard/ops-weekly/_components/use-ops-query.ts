"use client";

import { useSearchParams } from "next/navigation";

/** 주소의 쿼리 값 하나(`?section=` 등). 없으면 null. */
export function useOpsQueryValue(name: string): string | null {
  return useSearchParams()?.get(name) ?? null;
}

/**
 * 쿼리 값을 바꾼다(null 은 지운다). `use-ops-sub.ts` 의 `setSub` 와 같은 이유로
 * 상태가 아니라 `window.location` 을 읽고 `history.replaceState` 로 쓴다 — 서버 왕복·RSC 재요청이 없다.
 */
export function replaceOpsQuery(
  changes: Readonly<Record<string, string | null>>,
): void {
  const qs = new URLSearchParams(window.location.search);
  for (const [name, value] of Object.entries(changes)) {
    if (value === null) qs.delete(name);
    else qs.set(name, value);
  }
  window.history.replaceState(null, "", `${window.location.pathname}?${qs}`);
}
