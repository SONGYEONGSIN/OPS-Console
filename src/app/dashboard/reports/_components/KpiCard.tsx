import type { KpiItem } from "@/features/reports/schemas";

type Props = {
  item: KpiItem;
};

function formatValue(n: number): string {
  return n.toLocaleString("ko-KR");
}

/**
 * 분석보고서 단일 KPI 카드.
 * - 큰 숫자 + 라벨 + 단위 + 전 기간 대비 증감 ▲/▼
 * - goodOnIncrease=true 인데 증가 → vermilion (good)
 * - goodOnIncrease=false 인데 증가 → muted (bad)
 * - prevValue null → 증감 미표시
 */
export function KpiCard({ item }: Props) {
  const { label, value, delta, deltaPct, unit, goodOnIncrease } = item;
  const hasDelta = delta !== null;
  const isIncrease = hasDelta && delta > 0;
  const isDecrease = hasDelta && delta < 0;
  const isGood = isIncrease ? goodOnIncrease : isDecrease ? !goodOnIncrease : false;
  const arrow = isIncrease ? "▲" : isDecrease ? "▼" : "·";
  const toneClass = !hasDelta || delta === 0
    ? "text-muted"
    : isGood
      ? "text-vermilion"
      : "text-ink-soft";

  return (
    <div className="flex flex-col gap-1 border border-line bg-washi p-4">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums text-ink">
          {formatValue(value)}
        </span>
        <span className="text-xs text-muted">{unit}</span>
      </div>
      {hasDelta ? (
        <div className={`flex items-center gap-1 text-xs ${toneClass}`}>
          <span>{arrow}</span>
          <span className="tabular-nums">{Math.abs(delta)}</span>
          {deltaPct !== null ? (
            <span className="text-muted">({deltaPct > 0 ? "+" : ""}{deltaPct}%)</span>
          ) : null}
        </div>
      ) : (
        <div className="text-xs text-muted">비교 불가</div>
      )}
    </div>
  );
}
