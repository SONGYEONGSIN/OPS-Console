"use client";

import { useEffect, useState } from "react";
import {
  type ActivityLogEntry,
  selectTimelineEvents,
  timelinePercent,
  timelineDotClass,
  leaveCountdown,
  kstSecondsOfDay,
  kstDateYmd,
} from "./activity-log";
import { isKstBusinessDay } from "@/lib/business-days";
import {
  NOW_CHARACTERS,
  pickNowCharacterIndex,
  daySeedFromYmd,
} from "./now-characters";

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

/**
 * 실시간 운영 로그 — 가로 타임라인(09:00–18:00).
 * worklog 파생 ActivityLogEntry를 업무시간 축에 배치 + NOW 마커 + 퇴근 카운트다운(1초).
 */
export function ActivityTimeline({ entries }: { entries: ActivityLogEntry[] }) {
  // lazy init — SSR/CSR 시각 차는 동적 노드에 suppressHydrationWarning으로 흡수.
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const events = selectTimelineEvents(entries, 6);
  // 주말·공휴일엔 퇴근 카운트다운 미표시 (영업일만).
  const businessDay = isKstBusinessDay(now);
  const countdown = leaveCountdown(now);
  const nowPct = timelinePercent(kstSecondsOfDay(now) / 60);
  // 데일리 캐릭터 — KST 날짜 시드로 하루 한 종 선택(자정 KST에 회전, 하루 내 고정).
  const character =
    NOW_CHARACTERS[
      pickNowCharacterIndex(
        daySeedFromYmd(kstDateYmd(now.toISOString())),
        NOW_CHARACTERS.length,
      )
    ];

  return (
    <div className="mb-7">
      <div className="border border-line bg-paper shadow-offset-sm p-5">
        <h3 className="mb-1 text-2xl font-black leading-tight tracking-tight">
          실시간 운영 로그
        </h3>
        <div className="mb-4 flex items-center justify-between border-y border-line py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
          <span>Live Activity Stream</span>
          <span className="tabular-nums">
            09:00–18:00
            {businessDay && (
              <span className="text-ink-soft" suppressHydrationWarning>
                {" "}
                {countdown ? `(퇴근까지 ${countdown} 남음)` : "(업무 종료)"}
              </span>
            )}
          </span>
        </div>
        <div className="bs-tl">
          <div className="bs-tl-line" />
          {HOURS.map((h, i) => (
            <div
              key={h}
              className="bs-tl-hour"
              style={{ left: `${(i / (HOURS.length - 1)) * 100}%` }}
            >
              <div className="tick" />
              <div className="lab">{String(h).padStart(2, "0")}</div>
            </div>
          ))}
          {events.map((ev, i) => {
            const pct = timelinePercent(ev.minutesOfDay);
            // 가장자리 이벤트는 라벨이 컨테이너 밖으로 넘치지 않도록 안쪽 정렬
            // (오른쪽 끝 → 라벨 우측을 점에 맞춰 왼쪽으로, 왼쪽 끝 → 그 반대)
            const edge = pct >= 80 ? "cal-end" : pct <= 14 ? "cal-start" : "";
            return (
            <div
              key={ev.id}
              className="bs-tl-ev"
              style={{ left: `${pct}%` }}
            >
              <div className={`dot ${timelineDotClass(ev.tone)}`} />
              <div className={`cal ${i % 2 === 0 ? "up" : "dn"} ${edge}`}>
                <span className="t">{ev.hms.slice(0, 5)}</span>
                <div className={`m ${ev.tone === "err" ? "text-vermilion" : ""}`}>
                  {ev.text}
                </div>
              </div>
            </div>
            );
          })}
          <div
            className="bs-tl-now"
            style={{ left: `${nowPct}%` }}
            suppressHydrationWarning
          >
            <span className="lb bs-now-blink">NOW</span>
            <span className="ping bs-now-ping" />
            <span className="dot" />
            {/* 현재 시각 러너 — 데일리 캐릭터가 업무시간 축을 깡총깡총 달리는 인터랙션 */}
            <span className="run bs-now-run" aria-hidden="true">
              <svg viewBox="0 0 24 24" suppressHydrationWarning>
                {character.node}
              </svg>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
