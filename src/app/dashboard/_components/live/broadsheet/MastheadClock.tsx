"use client";

import { useEffect, useState } from "react";

const KST_FMT = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Vol. YYYY / MM · DD(요일) HH:MM:SS KST 형식 문자열 생성. */
function formatVol(date: Date): string {
  const parts = KST_FMT.formatToParts(date);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const weekday = get("weekday");
  const hour = get("hour");
  const minute = get("minute");
  const second = get("second");
  return `Vol. ${year} / ${month} · ${day}(${weekday}) ${hour}:${minute}:${second} KST`;
}

/**
 * MastheadClock — broadsheet 마스트헤드 실시간 시계 + LIVE.
 * KST 시각을 1초마다 갱신. 마운트 전에는 placeholder.
 */
export function MastheadClock() {
  const [volText, setVolText] = useState<string>(() => formatVol(new Date()));

  useEffect(() => {
    const id = window.setInterval(() => setVolText(formatVol(new Date())), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="text-xs font-bold text-muted uppercase tracking-[0.2em]">
      <span suppressHydrationWarning>{volText}</span>
      <span className="ml-3 text-vermilion font-black">
        <span className="bs-live-blink">●</span> LIVE
      </span>
    </div>
  );
}
