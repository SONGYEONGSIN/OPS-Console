"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  durationMs?: number;
};

/** 마운트 시 0 → value 카운트업 (ease-out cubic, rAF).
 *  prefers-reduced-motion이면 즉시 value.
 *  초기 state=value로 SSR↔클라이언트 hydration mismatch 회피. */
export function CountUp({ value, durationMs = 700 }: Props) {
  const [display, setDisplay] = useState(value);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Skip animation if already animated or if motion reduction is enabled
    if (reduce || hasAnimated.current) {
      return;
    }

    hasAnimated.current = true;
    let rafId = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const elapsed = t - start;
      const p = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(Math.round(value * eased));
      if (p < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [value, durationMs]);

  return <>{display}</>;
}
