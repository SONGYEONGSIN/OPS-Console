import Link from "next/link";
import { selectHeadline } from "./headline-selector";
import type { HeadlineInput, HeadlineSegment } from "./headline-selector";

/**
 * 상황실 v4 .headline — 자동 우선순위 헤드라인.
 * selectHeadline 결과를 grid(auto_1fr_auto)로 렌더. urgent는 좌측 vermilion bar 강조,
 * calm은 bar 없이 차분. 순수 렌더 컴포넌트(서버/클라이언트 무관).
 */
export function AutoHeadline({ input }: { input: HeadlineInput }) {
  const { mode, kicker, segments, sub, href } = selectHeadline(input);
  const isUrgent = mode === "urgent";

  return (
    <div
      className={[
        "grid grid-cols-[auto_1fr_auto] items-center gap-4 border bg-washi-raised p-4",
        isUrgent ? "border-line border-l-4 border-l-vermilion" : "border-line",
      ].join(" ")}
    >
      <span className="self-start border border-line-soft px-1.5 py-0.5 text-3xs font-bold uppercase tracking-[0.1em] text-muted">
        AUTO ▸ 우선순위 자동
      </span>

      <div>
        <div className="text-2xs font-bold uppercase tracking-[0.14em] text-vermilion">
          {kicker}
        </div>
        <h1 className="mt-0.5 text-2xl font-bold leading-tight">
          {segments.map((segment, index) => (
            <HeadlineSpan key={index} segment={segment} />
          ))}
        </h1>
        {sub ? <p className="mt-1 text-xs text-muted">{sub}</p> : null}
      </div>

      <Link
        href={href}
        className="whitespace-nowrap border border-line bg-ink px-4 py-2 text-sm font-bold text-cream"
      >
        {isUrgent ? "바로 처리 →" : "대시보드 →"}
      </Link>
    </div>
  );
}

function HeadlineSpan({ segment }: { segment: HeadlineSegment }) {
  if (segment.em) {
    return <span className="text-vermilion">{segment.text}</span>;
  }
  return <span>{segment.text}</span>;
}
