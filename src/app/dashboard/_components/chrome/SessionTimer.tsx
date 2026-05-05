"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "@/features/auth/actions";

// 15분(900초) idle 카운트다운 — mousemove/keydown/click 시 reset
const IDLE_SECONDS = 15 * 60;

function format(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function SessionTimer() {
  const [remaining, setRemaining] = useState(IDLE_SECONDS);
  const triggered = useRef(false);

  useEffect(() => {
    const reset = () => setRemaining(IDLE_SECONDS);
    const events: Array<keyof DocumentEventMap> = ["mousemove", "keydown", "click"];
    events.forEach((e) => document.addEventListener(e, reset));

    const interval = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0 && !triggered.current) {
          triggered.current = true;
          void signOut();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      events.forEach((e) => document.removeEventListener(e, reset));
      clearInterval(interval);
    };
  }, []);

  // 5분(300초) 미만 시 vermilion 강조
  const isLow = remaining <= 5 * 60;
  return (
    <span
      className="flex flex-col items-end leading-none"
      aria-label={`세션 ${format(remaining)} 남음`}
    >
      <span
        className={`text-sm font-bold tabular-nums ${
          isLow ? "text-vermilion" : "text-chrome-graphite"
        }`}
      >
        {format(remaining)}
      </span>
      <span className="mt-0.5 text-2xs font-bold uppercase tracking-[0.24em] text-chrome-muted">
        세션
      </span>
    </span>
  );
}
