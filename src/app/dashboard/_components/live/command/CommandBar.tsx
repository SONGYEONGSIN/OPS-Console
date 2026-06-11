import { LiveIndicator } from "../LiveIndicator";
import { SegmentToggle } from "../SegmentToggle";
import { LiveClock } from "./LiveClock";

/**
 * CommandBar — 상단 타이틀바(마스트헤드).
 *  `운영부 상황실` + OPS CONSOLE 라벨 + ●LIVE(LiveIndicator) + 실시간 시계
 *  + 우측 끝 전체/내담당 토글(SegmentToggle, URL ?mine 기반).
 *
 * 시스템 헬스(LED)·로그 티커는 하단 고정 `LiveStatusBar`로 분리됐다.
 * 토글은 SegmentToggle의 URL(?mine) 메커니즘을 그대로 재사용 — mine 값만 받는다.
 */
export function CommandBar({ mine }: { mine: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-2 border-line bg-cream px-4 py-2.5">
      <span className="text-xl font-bold tracking-[-0.01em] text-ink">
        운영부 상황실
      </span>
      <span className="hidden text-[9px] font-bold uppercase tracking-[0.22em] text-faint sm:inline">
        OPS CONSOLE · REALTIME
      </span>
      <LiveIndicator />
      <LiveClock />
      <div className="ml-auto">
        <SegmentToggle mine={mine} />
      </div>
    </div>
  );
}
