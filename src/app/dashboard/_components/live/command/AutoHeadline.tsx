import Link from "next/link";
import { selectHeadline } from "./headline-selector";
import type { HeadlineInput, HeadlineSegment } from "./headline-selector";

/**
 * 상황실 슬림 요약 밴드 — 자동 우선순위 헤드라인 한 줄 요약.
 * 시안(OPS-6) headline-band: crumb 오버바 + 대형 한 줄 + sub + 우측 vermilion 원형 stamp.
 * stamp는 최우선 메뉴로 이동하는 Link(기능 유지). 시급도 분류와 중복 없이 '한 줄 요약' 역할.
 */
export function AutoHeadline({ input }: { input: HeadlineInput }) {
  const { mode, kicker, segments, sub, href } = selectHeadline(input);
  const isUrgent = mode === "urgent";
  const stampCount =
    input.incidentsUnresolved ||
    input.deadlinesToday ||
    input.overdueReceivables ||
    0;

  return (
    <div className="border-b-2 border-ink bg-cream">
      {/* 오버바 crumb (CommandBar 마스트헤드와 중복 회피 — '실시간 현황'만) */}
      <div className="flex items-center gap-2 border-b border-line-soft px-5 py-1.5 text-[9px] tracking-[0.06em] text-muted">
        <span>실시간 현황</span>
        <span className="text-faint">·</span>
        <span>자동 우선순위</span>
      </div>

      <div className="flex items-start justify-between gap-4 px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="border border-line-soft px-1.5 py-0.5 text-3xs font-bold uppercase tracking-[0.1em] text-muted">
              AUTO ▸ 우선순위 자동
            </span>
            <span className="text-2xs font-bold uppercase tracking-[0.14em] text-vermilion">
              {kicker}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold leading-tight">
            {segments.map((segment, index) => (
              <HeadlineSpan key={index} segment={segment} />
            ))}
          </h1>
          {sub ? <p className="mt-1 text-xs text-muted">{sub}</p> : null}
        </div>

        <Link
          href={href}
          aria-label={
            isUrgent ? `긴급 ${stampCount}건 — 바로가기` : "대시보드로 이동"
          }
          className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border-2 transition-colors ${
            isUrgent
              ? "border-vermilion text-vermilion hover:bg-vermilion hover:text-cream"
              : "border-sage text-sage hover:bg-sage hover:text-cream"
          }`}
        >
          <span className="text-lg font-bold leading-none tabular-nums">
            {isUrgent ? stampCount : "✓"}
          </span>
          <span className="mt-0.5 text-[7px] uppercase tracking-[0.1em]">
            {isUrgent ? "긴급" : "평온"}
          </span>
        </Link>
      </div>
    </div>
  );
}

function HeadlineSpan({ segment }: { segment: HeadlineSegment }) {
  if (segment.em) {
    return <span className="text-vermilion">{segment.text}</span>;
  }
  return <span>{segment.text}</span>;
}
