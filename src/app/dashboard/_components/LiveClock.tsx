"use client";

import { useEffect, useState } from "react";

/**
 * LiveClock — TitleBar 우측의 실시간 일자/요일/시각 + 연결 표시.
 * SSR-hydration 미스매치 회피: suppressHydrationWarning + 클라이언트 mount 후 갱신.
 */
const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

function format(now: Date): string {
  const yyyy = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const w = WEEKDAY_KO[now.getDay()];
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}.${mo}.${dd} (${w}) ${hh}:${mm}:${ss}`;
}

export function LiveClock() {
  const [text, setText] = useState<string>(() => format(new Date()));

  useEffect(() => {
    const id = window.setInterval(() => {
      setText(format(new Date()));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-3.5 text-[10px] tracking-[0.08em] opacity-75">
      <span className="font-mono tabular-nums" suppressHydrationWarning>
        {text}
      </span>
      <span className="flex items-center gap-1">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-sage" />
        실시간 연결
      </span>
    </div>
  );
}
