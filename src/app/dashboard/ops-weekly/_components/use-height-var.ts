"use client";

import { useEffect, type RefObject } from "react";

/**
 * 고정(sticky) 막대의 높이를 부모 요소의 CSS 변수로 알린다 — 그 아래에 붙는 막대가 `top` 에 더해 쓴다.
 * 부모에 쓰는 이유: 아래 막대는 같은 부모 안의 후손이라 변수를 물려받는다.
 * 숨은 패널(display:none)은 높이 0 이라 변수를 지운다 — 다시 보이면 ResizeObserver 가 다시 쓴다.
 */
export function useHeightVar(
  ref: RefObject<HTMLElement | null>,
  name: string,
): void {
  useEffect(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (!el || !host || typeof ResizeObserver === "undefined") return;
    const write = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) host.style.setProperty(name, `${Math.ceil(h)}px`);
      else host.style.removeProperty(name);
    };
    write();
    const ro = new ResizeObserver(write);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [ref, name]);
}
