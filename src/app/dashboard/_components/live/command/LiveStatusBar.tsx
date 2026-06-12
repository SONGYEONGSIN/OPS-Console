"use client";

import { LiveIndicator } from "../LiveIndicator";
import { HealthGateway, type HealthGatewayItem } from "./HealthGateway";
import LogTicker from "./LogTicker";
import type { ConsoleLogEntry } from "../mock-log-pool";

/**
 * LiveStatusBar — 하단 고정 status bar.
 *  상단행: 시스템 헬스(LED 게이트웨이) + 우측 ●LIVE.
 *  하단행: 실시간 로그 티커(가로 흐름).
 *
 * CommandBar(상단 타이틀바)에서 분리해 화면 하단에 sticky로 상주한다
 * (IDE/터미널 status line 패턴). 데이터는 LiveOverview가 내려준다.
 */
export function LiveStatusBar({
  healthItems,
  logLines,
}: {
  healthItems: HealthGatewayItem[];
  logLines: ConsoleLogEntry[];
}) {
  return (
    <div className="sticky bottom-0 z-20 border-t-2 border-ink bg-washi-raised">
      <div className="flex items-center">
        <div className="min-w-0 flex-1">
          <HealthGateway items={healthItems} />
        </div>
        <div className="flex shrink-0 items-center border-l border-line-soft px-3">
          <LiveIndicator />
        </div>
      </div>
      <LogTicker lines={logLines} />
    </div>
  );
}
