"use client";

import { useEffect, useState } from "react";

const DATE_FMT = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
});

const TIME_FMT = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type Snapshot = {
  date: string;
  time: string;
};

/**
 * Intl 출력(ko-KR)을 `2026-06-11 (목)` / `15:24:07` 형태로 정규화.
 * ko-KR date는 "2026. 06. 11. 목" 류로 나오므로 파트 추출 후 재조립.
 */
function formatNow(now: Date): Snapshot {
  const dateParts = DATE_FMT.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    dateParts.find((p) => p.type === type)?.value ?? "";

  const date = `${get("year")}-${get("month")}-${get("day")} (${get("weekday")})`;
  const time = TIME_FMT.format(now);

  return { date, time };
}

const PLACEHOLDER: Snapshot = {
  date: "------ (-)",
  time: "--:--:--",
};

export function LiveClock() {
  const [snapshot, setSnapshot] = useState<Snapshot>(PLACEHOLDER);

  useEffect(() => {
    const tick = () => setSnapshot(formatNow(new Date()));
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="inline-flex items-baseline gap-2 text-xs text-muted">
      <span>{snapshot.date}</span>
      <span className="tabular-nums">{snapshot.time}</span>
      <span>KST</span>
    </span>
  );
}
