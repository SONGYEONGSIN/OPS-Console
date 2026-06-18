"use client";

import { useEffect, useMemo, useState } from "react";
import type { LiveTableItem } from "./live-table-builder";
import { SOLID_BADGE } from "./domain-tag";

// KST 시간대 계산용 유틸리티 함수
function getKstDateAndMinutes(dateInput: Date | string | null): {
  ymd: string;
  minutes: number;
  timeStr: string;
} | null {
  if (!dateInput) return null;
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return null;

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    const getVal = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? "";

    const yyyy = getVal("year");
    const mm = getVal("month");
    const dd = getVal("day");
    const hour = Number(getVal("hour"));
    const minute = Number(getVal("minute"));

    const ymd = `${yyyy}-${mm}-${dd}`;
    const minutes = hour * 60 + minute;
    const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

    return { ymd, minutes, timeStr };
  } catch {
    return null;
  }
}

type TimelineNode = {
  id: string;
  title: string;
  timeStr: string;
  pct: number;
  domain: string;
  badge: string;
  badgeClass: string;
  isSimulated?: boolean;
  item?: LiveTableItem;
};

// 09:00 ~ 18:00 KST (분 단위: 540 ~ 1080)
const WORK_START_MIN = 9 * 60; // 540
const WORK_END_MIN = 18 * 60; // 1080
const WORK_DURATION_MIN = WORK_END_MIN - WORK_START_MIN; // 540

export function TodayFlow({
  items,
  onSelect,
}: {
  items: LiveTableItem[];
  onSelect: (item: LiveTableItem) => void;
}) {
  const [nowMin, setNowMin] = useState<number | null>(null);
  const [hoveredNode, setHoveredNode] = useState<TimelineNode | null>(null);

  // 실시간 NOW 타임바 갱신 (10초 주기로 위치 계산)
  useEffect(() => {
    const updateNow = () => {
      const parsed = getKstDateAndMinutes(new Date());
      if (parsed) {
        setNowMin(parsed.minutes);
      }
    };
    updateNow();
    const timer = setInterval(updateNow, 10000);
    return () => clearInterval(timer);
  }, []);

  const nowPct = useMemo(() => {
    if (nowMin === null) return null;
    const clamped = Math.max(WORK_START_MIN, Math.min(WORK_END_MIN, nowMin));
    return ((clamped - WORK_START_MIN) / WORK_DURATION_MIN) * 100;
  }, [nowMin]);

  // 오늘의 노드 목록 생성
  const timelineNodes = useMemo(() => {
    const kstNow = getKstDateAndMinutes(new Date());
    if (!kstNow) return [];
    const todayYmd = kstNow.ymd;

    const nodes: TimelineNode[] = [];

    // 1. 실제 데이터 매핑
    for (const it of items) {
      // 각 도메인별 기준 시간 추출
      let timeInput: string | null = null;
      if (it.domain === "schedule" && it.listRow.start_at) {
        timeInput = it.listRow.start_at as string;
      } else if (it.domain === "todos" && it.listRow.dueAt) {
        timeInput = it.listRow.dueAt as string;
      } else if (it.occurredAt) {
        timeInput = it.occurredAt;
      }

      const parsed = getKstDateAndMinutes(timeInput);
      if (parsed && parsed.ymd === todayYmd) {
        // 근무시간(09:00 ~ 18:00) 내 맵핑
        const clampedMin = Math.max(
          WORK_START_MIN,
          Math.min(WORK_END_MIN, parsed.minutes),
        );
        const pct = ((clampedMin - WORK_START_MIN) / WORK_DURATION_MIN) * 100;

        nodes.push({
          id: it.id,
          title: it.title,
          timeStr: parsed.timeStr,
          pct,
          domain: it.domain,
          badge: it.badgeDomain,
          badgeClass: SOLID_BADGE[it.badgeDomain] ?? "bg-ink text-cream",
          item: it,
        });
      }
    }

    // 2. 만약 오늘의 실제 이벤트가 3개 미만인 경우 상황실 분위기를 유지하기 위한 고정 시뮬레이션 데이터 믹스
    if (nodes.length < 3) {
      const simulated: TimelineNode[] = [
        {
          id: "sim-1",
          title: "일일 미수채권 자동 독려 발송 (3건)",
          timeStr: "10:38",
          pct: ((10 * 60 + 38 - WORK_START_MIN) / WORK_DURATION_MIN) * 100,
          domain: "backup",
          badge: "시스템",
          badgeClass: "bg-sage text-cream",
          isSimulated: true,
        },
        {
          id: "sim-2",
          title: "운영본부 오전 당직 교대 및 업무 로그 점검",
          timeStr: "13:05",
          pct: ((13 * 60 + 5 - WORK_START_MIN) / WORK_DURATION_MIN) * 100,
          domain: "schedule",
          badge: "일정",
          badgeClass: "bg-indigo text-cream",
          isSimulated: true,
        },
        {
          id: "sim-3",
          title: "건국대(글로벌) 후기 2차 원서 접수 서비스 마감",
          timeStr: "18:00",
          pct: 100,
          domain: "services",
          badge: "서비스",
          badgeClass: "bg-vermilion text-cream",
          isSimulated: true,
        },
      ];

      // 이미 비슷한 시간대(오차 15분)에 실제 노드가 있는 것은 제외하고 추가
      for (const sim of simulated) {
        const simMin =
          sim.pct === 100
            ? WORK_END_MIN
            : WORK_START_MIN + (sim.pct * WORK_DURATION_MIN) / 100;
        const hasOverlap = nodes.some((n) => {
          const nMin = WORK_START_MIN + (n.pct * WORK_DURATION_MIN) / 100;
          return Math.abs(nMin - simMin) < 15;
        });
        if (!hasOverlap) {
          nodes.push(sim);
        }
      }
    }

    // 시간 오름차순 정렬
    return nodes.sort((a, b) => a.pct - b.pct);
  }, [items]);

  const handleNodeClick = (node: TimelineNode) => {
    if (node.item) {
      onSelect(node.item);
    }
  };

  return (
    <section
      aria-label="오늘의 흐름 타임라인"
      className="relative flex flex-col gap-3"
    >
      <div className="flex items-baseline justify-between border-b-2 border-ink pb-1.5">
        <h2 className="text-sm font-bold tracking-[0.02em] text-ink">
          오늘의 흐름
          <span className="ml-2 text-xs font-normal text-muted">
            근무 시간(09:00 ~ 18:00 KST) 실시간 이벤트 현황
          </span>
        </h2>
        <span className="text-xs text-muted">노드 클릭 → 상세</span>
      </div>

      <div className="relative border border-line-soft bg-cream px-6 py-10">
        <div className="relative mx-4 h-[2px] bg-line-soft">
          {/* 시간 눈금 (Ticks & Labels) */}
          {[
            { label: "09:00", pct: 0 },
            { label: "12:00", pct: 33.33 },
            { label: "15:00", pct: 66.67 },
            { label: "18:00", pct: 100 },
          ].map((tick) => (
            <div
              key={tick.label}
              className="absolute -translate-x-1/2"
              style={{ left: `${tick.pct}%` }}
            >
              <div className="absolute top-[-4px] h-[10px] w-[1px] bg-faint" />
              <span className="absolute top-[12px] -translate-x-1/2 font-mono text-[9px] font-semibold text-muted">
                {tick.label}
              </span>
            </div>
          ))}

          {/* 실시간 NOW 바 */}
          {nowPct !== null && (
            <div
              className="absolute z-20 -translate-x-1/2 pointer-events-none"
              style={{ left: `${nowPct}%` }}
            >
              <div className="absolute top-[-24px] -translate-x-1/2 whitespace-nowrap font-mono text-[9px] font-extrabold text-vermilion bg-cream px-1 border border-vermilion animate-[led-flicker_1s_infinite_alternate]">
                NOW
              </div>
              <div className="absolute top-[-10px] h-[22px] w-[2px] bg-vermilion shadow-led-vermilion" />
            </div>
          )}

          {/* 타임라인 노드들 */}
          {timelineNodes.map((node, index) => {
            // 레이블 위아래 엇갈림 배치로 중첩 방지
            const labelAbove = index % 2 === 0;

            let colorClass = "bg-muted";
            if (node.domain === "incidents") colorClass = "bg-vermilion";
            else if (node.domain === "todos") colorClass = "bg-amber";
            else if (node.domain === "schedule") colorClass = "bg-indigo";
            else if (node.domain === "services") colorClass = "bg-sage";
            else if (node.domain === "backup") colorClass = "bg-sage";
            else if (node.domain === "handover") colorClass = "bg-gold";

            return (
              <div
                key={node.id}
                className="absolute -translate-x-1/2"
                style={{ left: `${node.pct}%` }}
              >
                {/* 꼬리표/심플 레이블 */}
                <div
                  className={`absolute -translate-x-1/2 whitespace-nowrap text-[9px] font-bold transition-all ${
                    labelAbove ? "top-[-25px]" : "top-[14px]"
                  } ${node.item ? "cursor-pointer text-ink hover:text-vermilion hover:underline" : "text-muted"}`}
                  onClick={() => handleNodeClick(node)}
                >
                  <span className="font-mono text-[8px] font-semibold text-muted mr-1">
                    {node.timeStr}
                  </span>
                  {node.title.slice(0, 10)}
                  {node.title.length > 10 ? "..." : ""}
                </div>

                {/* 노드 포인트 (원형 단추) */}
                <button
                  type="button"
                  aria-label={node.title}
                  onClick={() => handleNodeClick(node)}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                  disabled={!node.item}
                  className={`absolute top-[-5px] h-[12px] w-[12px] -translate-x-1/2 rounded-full border-2 border-cream transition-transform duration-150 hover:scale-135 focus:outline-none ${
                    node.item ? "cursor-pointer shadow-md" : "cursor-default opacity-85"
                  } ${colorClass}`}
                />
              </div>
            );
          })}
        </div>

        {/* 인터랙티브 마우스 호버 툴팁 */}
        {hoveredNode && (
          <div
            className="absolute z-30 pointer-events-none flex flex-col border border-line bg-ink p-3 text-cream shadow-xl transition-opacity duration-150 w-[240px]"
            style={{
              left: `${Math.min(80, Math.max(5, hoveredNode.pct))}%`,
              top: hoveredNode.pct % 2 === 0 ? "55px" : "-65px",
              transform: "translateX(-50%)",
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className={`inline-block px-1 py-px text-[9px] font-extrabold leading-none ${hoveredNode.badgeClass}`}
              >
                {hoveredNode.badge}
              </span>
              <span className="font-mono text-[9px] text-faint font-bold">
                {hoveredNode.timeStr} KST
              </span>
              {hoveredNode.isSimulated && (
                <span className="ml-auto text-[8px] border border-faint/30 px-1 text-faint font-medium">
                  시뮬레이션
                </span>
              )}
            </div>
            <h4 className="text-[11px] font-bold leading-snug line-clamp-2 text-cream mb-1">
              {hoveredNode.title}
            </h4>
            {hoveredNode.item && (
              <p className="text-[9px] text-faint">
                클릭 시 상황판 인스펙터 패널 연동
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
