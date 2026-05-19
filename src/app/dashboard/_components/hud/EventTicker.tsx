export type TickerEvent = { id: string; label: string };

/**
 * EventTicker — 하단 가로 스트립. 이벤트 라벨을 좌→우로 표시.
 * 1차는 정적 marquee(애니메이션 없는 한 줄 분리). follow-up: CSS marquee 애니메이션.
 */
export function EventTicker({ events }: { events: TickerEvent[] }) {
  if (events.length === 0) {
    return <p className="text-xs text-muted">이벤트 없음 — 정상</p>;
  }
  return (
    <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap text-xs">
      <span aria-hidden className="text-vermilion">
        ◀
      </span>
      {events.map((e, i) => (
        <span key={e.id} className="flex items-center gap-2">
          <span className="text-ink-soft">{e.label}</span>
          {i < events.length - 1 ? (
            <span aria-hidden className="text-line">
              │
            </span>
          ) : null}
        </span>
      ))}
      <span aria-hidden className="text-vermilion">
        ▶
      </span>
    </div>
  );
}
