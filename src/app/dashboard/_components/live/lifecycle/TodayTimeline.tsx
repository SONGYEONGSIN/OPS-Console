import { computeTimeline } from "./timeline-points";
import type { TimelineEvent, TimelineKind } from "./timeline-points";

type Props = {
  events: TimelineEvent[];
  /** 현재 시각 (ISO, 오프셋 권장). NOW 마커 위치 계산에 사용. */
  nowIso: string;
};

/** kind별 점 색상 토큰 (디자인 토큰 Tailwind 클래스). */
const KIND_DOT: Record<TimelineKind, string> = {
  due: "bg-vermilion",
  mail: "bg-sage",
  sch: "bg-indigo",
};

/** 09~18 축 기준 틱 라벨 위치(%) — 09:00=0 / 12:00=33.33 / 15:00=66.67 / 18:00=100. */
const TICKS = [
  { label: "09:00", pct: 0 },
  { label: "12:00", pct: 100 / 3 },
  { label: "15:00", pct: 200 / 3 },
  { label: "18:00", pct: 100 },
];

/**
 * 오늘의 흐름(09:00~18:00 KST) 가로 타임라인.
 * v4 .timeline: 얇은 박스 + 가로 axis + 틱 + NOW(vermilion 세로) + kind별 점 + 점 라벨.
 */
export function TodayTimeline({ events, nowIso }: Props) {
  const { points, nowPct } = computeTimeline(events, nowIso);

  return (
    <div className="relative border border-line-soft bg-cream px-4 pb-3.5 pt-2.5">
      <div className="mb-2.5 text-[10px] font-bold tracking-[0.04em] text-muted">
        ▌ 오늘의 흐름
      </div>
      <div className="relative mx-1 h-0.5 bg-line-soft">
        {TICKS.map((tick) => (
          <div key={tick.label}>
            <span
              className="absolute -top-1 h-2.5 w-px bg-faint"
              // 동적 좌표(일회성): 09~18 축 고정 틱 위치
              style={{ left: `${tick.pct}%` }}
            />
            <span
              className="absolute top-2 -translate-x-1/2 text-[9px] text-muted"
              // 동적 좌표(일회성): 틱 라벨 정렬
              style={{ left: `${tick.pct}%` }}
            >
              {tick.label}
            </span>
          </div>
        ))}

        {points.map((point) => (
          <div key={point.id}>
            <span
              data-timeline-point
              data-kind={point.kind}
              className={`absolute -top-1.5 h-3 w-3 -translate-x-1/2 rounded-full border-[1.5px] border-cream ${KIND_DOT[point.kind]}`}
              // 동적 좌표(일회성): 이벤트 시각 → leftPct
              style={{ left: `${point.leftPct}%` }}
            />
            <span
              className="absolute -top-5 -translate-x-1/2 whitespace-nowrap text-[9px] text-ink-soft"
              // 동적 좌표(일회성): 점 라벨 정렬
              style={{ left: `${point.leftPct}%` }}
            >
              {point.label}
            </span>
          </div>
        ))}

        <span
          data-timeline-now
          className="absolute -top-2.5 h-5 w-0.5 bg-vermilion"
          // 동적 좌표(일회성): 현재 시각 → nowPct
          style={{ left: `${nowPct}%` }}
        />
        <span
          className="absolute -top-[22px] -translate-x-1/2 text-[9px] font-bold text-vermilion"
          // 동적 좌표(일회성): NOW 라벨 정렬
          style={{ left: `${nowPct}%` }}
        >
          NOW
        </span>
      </div>
    </div>
  );
}
