"use client";

import { useEffect, useRef, useState } from "react";
import {
  type ActivityLogEntry,
  groupTimelineEvents,
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

  const groups = groupTimelineEvents(entries, 6);
  // 클릭으로 펼친 그룹 팝오버 — 클릭한 (+N) 버튼 화면 좌표 기준 fixed 드롭다운.
  // 카드가 세로로 좁아 inline 절대배치는 라벨과 겹치므로 fixed로 띄운다.
  const [popover, setPopover] = useState<{
    id: string;
    members: ActivityLogEntry[];
    x: number;
    y: number;
  } | null>(null);
  const tlRef = useRef<HTMLDivElement>(null);
  // 외부 클릭 / Escape / 스크롤 시 팝오버 닫기. 마커·팝오버 내부 클릭은 무시.
  useEffect(() => {
    if (!popover) return;
    const onDown = (e: MouseEvent) => {
      if (!tlRef.current?.contains(e.target as Node)) setPopover(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopover(null);
    };
    const onScroll = () => setPopover(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [popover]);

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
        <div className="bs-tl" ref={tlRef}>
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
          {groups.map((g, i) => {
            const pct = timelinePercent(g.minutesOfDay);
            // 가장자리 이벤트는 라벨이 컨테이너 밖으로 넘치지 않도록 안쪽 정렬
            // (오른쪽 끝 → 라벨 우측을 점에 맞춰 왼쪽으로, 왼쪽 끝 → 그 반대)
            const edge = pct >= 80 ? "cal-end" : pct <= 14 ? "cal-start" : "";
            const extra = g.members.length - 1;
            const expandable = extra > 0;
            const up = i % 2 === 0;
            const open = popover?.id === g.lead.id;
            const calClass = `cal ${up ? "up" : "dn"} ${edge}${
              expandable ? " cal-group" : ""
            }`;
            const label = (
              <>
                <span className="t">{g.lead.hms.slice(0, 5)}</span>
                <div
                  className={`m ${g.lead.tone === "err" ? "text-vermilion" : ""}`}
                >
                  {g.lead.text}
                  {extra > 0 ? ` (+${extra})` : ""}
                </div>
              </>
            );
            return (
              <div key={g.lead.id} className="bs-tl-ev" style={{ left: `${pct}%` }}>
                <div className={`dot ${timelineDotClass(g.lead.tone)}`} />
                {expandable ? (
                  <button
                    type="button"
                    className={calClass}
                    aria-expanded={open}
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setPopover((cur) =>
                        cur?.id === g.lead.id
                          ? null
                          : {
                              id: g.lead.id,
                              members: g.members,
                              x: r.left,
                              y: r.bottom + 6,
                            },
                      );
                    }}
                  >
                    {label}
                  </button>
                ) : (
                  <div className={calClass}>{label}</div>
                )}
              </div>
            );
          })}
          {popover && (
            <div
              className="fixed z-[200] w-[280px] max-h-[260px] overflow-y-auto border border-line bg-paper text-[11px] font-bold leading-snug [box-shadow:3px_3px_0_var(--line-soft)]"
              style={{
                left: `${Math.max(8, Math.min(popover.x, (typeof window !== "undefined" ? window.innerWidth : 1400) - 288))}px`,
                top: `${popover.y}px`,
              }}
            >
              <ul className="divide-y divide-line-soft">
                {popover.members.map((m) => (
                  <li
                    key={m.id}
                    className="flex gap-2 px-2.5 py-1.5 hover:bg-washi-raised"
                  >
                    <span className="shrink-0 tabular-nums text-[10px] text-muted">
                      {m.hms.slice(0, 5)}
                    </span>
                    <span
                      className={`min-w-0 ${m.tone === "err" ? "text-vermilion" : ""}`}
                    >
                      {m.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
