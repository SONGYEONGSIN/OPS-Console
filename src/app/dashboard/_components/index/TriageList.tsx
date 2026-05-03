import type { DashWidget } from "../patterns/DashPattern";

/**
 * TriageList — 1면 좌상단 "긴급 처리". urgent 톤 위젯만 추려 신문 칼럼처럼 노출.
 * 카드 그리드가 아니라 줄 단위 리스트(낙관 vermilion 마커 + 라벨/값/시각)로
 * 입실 직후 5초 안에 "지금 무엇을 봐야 하는가"를 가르친다.
 */
export function TriageList({
  widgets,
  max,
}: {
  widgets: DashWidget[];
  max: number;
}) {
  const urgent = widgets.filter((w) => w.tone === "urgent").slice(0, max);

  if (urgent.length === 0) {
    return (
      <p className="border-l-2 border-sage py-1 pl-3 text-sm text-ink-soft">
        currently 정상 — 긴급 처리 항목 없음
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line-soft">
      {urgent.map((w) => (
        <li
          key={w.id}
          className="grid grid-cols-[10px_1fr_auto_auto] items-baseline gap-3 py-2.5"
        >
          <span aria-hidden className="h-1.5 w-1.5 self-center bg-vermilion" />
          <span className="text-sm leading-tight text-ink">{w.label}</span>
          <span className="font-mono text-sm font-semibold tracking-tight text-vermilion">
            {w.value}
          </span>
          <span className="font-mono text-2xs uppercase tracking-[0.12em] text-muted">
            {w.time}
          </span>
        </li>
      ))}
    </ul>
  );
}
