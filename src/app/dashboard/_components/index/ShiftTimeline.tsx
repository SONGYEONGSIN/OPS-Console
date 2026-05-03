"use client";

import { useEffect, useMemo, useState } from "react";
import type { ShiftEvent } from "../../_data/patterns";

/**
 * ShiftTimeline — 14:00–22:00 KST 시프트의 진행도와 주요 이벤트.
 * 카드/원형 차트가 아니라 신문 사이드바의 vertical 시각표:
 * 1) 좌측 vermilion ink 진행 막대 (현재 시각까지 채워짐)
 * 2) 각 이벤트 시각 + 라벨 (font-mono + Pretendard)
 *
 * 시계 의존이라 useEffect로 진입 직후 동기화하고 1분마다 갱신.
 */
function clampPct(n: number) {
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

function calcProgressPct(now: Date, startHour: number, endHour: number): number {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = startHour * 60;
  const end = endHour * 60;
  const span = end - start;
  if (span <= 0) return 0;
  return clampPct(((minutes - start) / span) * 100);
}

export function ShiftTimeline({
  events,
  startHour,
  endHour,
}: {
  events: ShiftEvent[];
  startHour: number;
  endHour: number;
}) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const pct = useMemo(
    () => calcProgressPct(now, startHour, endHour),
    [now, startHour, endHour],
  );

  return (
    <div className="grid grid-cols-[auto_1fr] gap-4">
      <div className="relative w-1 bg-line-soft">
        <div
          data-testid="shift-progress"
          className="absolute inset-x-0 top-0 bg-vermilion"
          style={{ height: `${pct}%` }}
        />
      </div>
      <ol className="flex flex-col gap-2.5">
        <li className="text-2xs uppercase tracking-[0.18em] text-faint">
          {`${String(startHour).padStart(2, "0")}:00 KST 개시`}
        </li>
        {events.map((e) => (
          <li
            key={`${e.at}-${e.label}`}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <span className="font-mono text-2xs tracking-tight text-vermilion">
              {e.at}
            </span>
            <span className="flex-1 text-ink-soft">{e.label}</span>
          </li>
        ))}
        <li className="text-2xs uppercase tracking-[0.18em] text-faint">
          {`${String(endHour).padStart(2, "0")}:00 KST 마감`}
        </li>
      </ol>
    </div>
  );
}
