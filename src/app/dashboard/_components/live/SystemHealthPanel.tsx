"use client";

import { SideBox } from "./SideBox";
import { HealthLed } from "./HealthLed";

/** 시스템 게이트웨이 상태 — 3 항목 (YouTube quota / Supabase / Cron), 모든 LED vermilion.
 *  Cron은 항상 정상 가동 표시 (sim 제거). */
export function SystemHealthPanel() {
  return (
    <SideBox
      title="시스템 게이트웨이 상태"
      titleRight={<HealthLed variant="vermilion" />}
    >
      <ul className="flex flex-1 flex-col justify-around gap-3">
        <li className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold text-ink">
            <HealthLed variant="vermilion" />
            YouTube API Quota
          </span>
          <span className="text-xs font-bold tabular-nums text-ink-soft">
            67.2% 잔여
          </span>
        </li>
        <li className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold text-ink">
            <HealthLed variant="vermilion" />
            Supabase Connection
          </span>
          <span className="text-xs font-bold tabular-nums text-ink-soft">
            12ms (Good)
          </span>
        </li>
        <li className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold text-ink">
            <HealthLed variant="vermilion" />
            Cron 자동화 엔진
          </span>
          <span className="text-xs font-bold tabular-nums text-ink-soft">
            정상 가동
          </span>
        </li>
      </ul>
    </SideBox>
  );
}
