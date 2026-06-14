import type { ActivityLogEntry } from "./activity-log";
import { MastheadClock } from "./MastheadClock";
import { ScopeTextToggle } from "./ScopeTextToggle";
import { SystemLogToggle } from "./SystemLogToggle";

type Props = {
  mine: boolean;
  activityLog: ActivityLogEntry[];
};

/**
 * Broadsheet 마스트헤드 — 어플라이·운영부 / 시스템 로그 펼치기 / 전체·내담당 토글
 * + 실시간 클록(● LIVE) + 신문 제호 "운영부 상황실".
 */
export function Masthead({ mine, activityLog }: Props) {
  return (
    <div className="mb-7 border-b-[4px] border-ink pb-5">
      <div className="mb-5 flex flex-col items-start justify-between gap-2 border-b border-line pb-2 md:flex-row md:items-end">
        <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-muted">
          <span>어플라이 · 운영부</span>
          <span className="text-line-soft">|</span>
          <SystemLogToggle entries={activityLog} />
          <span className="text-line-soft">|</span>
          <ScopeTextToggle mine={mine} />
        </div>
        <MastheadClock />
      </div>
      <div className="text-center">
        <h1 className="text-5xl font-black uppercase leading-none tracking-[-0.04em] text-ink md:text-[72px]">
          운영부 상황실
        </h1>
        <div className="mt-3 text-sm font-semibold uppercase tracking-[0.25em] text-muted md:text-[15px]">
          Real-Time Operations Monitoring &amp; Triage
        </div>
      </div>
    </div>
  );
}
