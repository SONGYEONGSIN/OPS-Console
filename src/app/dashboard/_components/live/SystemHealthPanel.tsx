"use client";

import { SideBox } from "./SideBox";
import { HealthLed } from "./HealthLed";

type Props = { cronActive: boolean };

/** 시스템 게이트웨이 상태 — 3 항목 (YouTube quota / Supabase / Cron), 모든 LED vermilion(빨강).
 *  cronActive=true 시 Cron LED flicker (강한 빨강 깜박) + 텍스트 '스케줄 수집 작동 중'.
 *  카드 자체 min-h-[320px] (KPI 카드 자연 render와 시각 정렬). */
export function SystemHealthPanel({ cronActive }: Props) {
  return (
    <SideBox
      title="시스템 게이트웨이 상태"
      titleRight={<HealthLed variant="vermilion" />}
      className="min-h-[320px]"
    >
      <ul className="flex h-full flex-col justify-around gap-3">
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold text-ink">
              <HealthLed variant="vermilion" />
              YouTube API Quota
            </span>
            <span className="text-xs font-bold tabular-nums text-ink-soft">67.2% 잔여</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold text-ink">
              <HealthLed variant="vermilion" />
              Supabase Connection
            </span>
            <span className="text-xs font-bold tabular-nums text-ink-soft">12ms (Good)</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold text-ink">
              <HealthLed variant="vermilion" flicker={cronActive} />
              Cron 자동화 엔진
            </span>
            <span className="text-xs font-bold tabular-nums text-ink-soft">
              {cronActive ? "스케줄 수집 작동 중" : "정상 가동"}
            </span>
          </li>
        </ul>
    </SideBox>
  );
}
