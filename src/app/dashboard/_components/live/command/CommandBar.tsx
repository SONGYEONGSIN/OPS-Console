import { LiveIndicator } from "../LiveIndicator";
import { SegmentToggle } from "../SegmentToggle";
import { LiveClock } from "./LiveClock";
import { HealthGateway, type HealthGatewayItem } from "./HealthGateway";
import LogTicker from "./LogTicker";
import type { ConsoleLogEntry } from "../mock-log-pool";

/**
 * CommandBar — 상황실 v4 `.cmd` 박스. 3행 구성:
 *  - 상단행(.cmd-top): 마스트헤드 `운영부 상황실` + `●LIVE`(LiveIndicator) + 실시간 시계
 *    + 우측 끝 전체/내담당 토글(SegmentToggle, URL 기반).
 *  - 중간행(.weather): HealthGateway 시스템 날씨 요약.
 *  - 하단행(.ticker): LogTicker 가로 콘솔 로그.
 *
 * 토글은 기존 SegmentToggle의 URL(?mine) 메커니즘을 그대로 재사용한다 —
 * 별도 onToggle 콜백 없이 mine 값만 받아 active 상태를 표시한다.
 * 데이터(healthItems / logLines)는 LiveOverview가 내려준다.
 */
export function CommandBar({
  mine,
  healthItems,
  logLines,
}: {
  mine: boolean;
  healthItems: HealthGatewayItem[];
  logLines: ConsoleLogEntry[];
}) {
  return (
    <div className="border border-line bg-cream">
      {/* 상단행 — 마스트헤드 + LIVE + 시계 + 토글 */}
      <div className="flex items-center gap-3.5 border-b border-line-soft px-4 py-[11px]">
        <span className="text-xl font-bold tracking-[-0.01em] text-ink">
          운영부 상황실
        </span>
        <LiveIndicator />
        <LiveClock />
        <div className="ml-auto">
          <SegmentToggle mine={mine} />
        </div>
      </div>

      {/* 중간행 — 시스템 날씨 게이트웨이 요약 */}
      <HealthGateway items={healthItems} />

      {/* 하단행 — 가로 콘솔 로그 티커 */}
      <LogTicker lines={logLines} />
    </div>
  );
}
