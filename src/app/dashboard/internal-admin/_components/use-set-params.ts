"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Patch = Record<string, string | null>;

/**
 * 주소 파라미터 patch — 다른 파라미터는 남기고 `null`/`""` 는 지운다.
 * patch 에 `page` 가 없으면 `page` 를 지운다(필터가 바뀌면 1쪽부터).
 */
export function useSetParams(): (patch: Patch) => void {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return useCallback(
    (patch: Patch) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") next.delete(k);
        else next.set(k, v);
      }
      if (!("page" in patch)) next.delete("page");
      router.push(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router],
  );
}

/** 검색창 상태 — 입력이 멈춘 뒤 `delayMs` 만에 한 번만 주소로 옮긴다. */
export function useDebouncedSearch(
  key: string,
  delayMs = 300,
): [string, (v: string) => void] {
  const params = useSearchParams();
  const setParams = useSetParams();
  const current = params.get(key) ?? "";
  const [value, setValue] = useState(current);
  // 이 훅이 마지막으로 주소에 올린 값 — 이것과 다른 값으로 주소가 바뀌면 바깥(뒤로 가기·다른 컨트롤)이다.
  const pushed = useRef(current);

  useEffect(() => {
    if (current === pushed.current) return;
    pushed.current = current;
    setValue(current);
  }, [current]);

  useEffect(() => {
    if (value === current) return;
    const id = setTimeout(() => {
      pushed.current = value;
      setParams({ [key]: value || null });
    }, delayMs);
    return () => clearTimeout(id);
  }, [value, current, key, delayMs, setParams]);

  return [value, setValue];
}
