import type { KpiItem } from "@/features/reports/schemas";

type Props = {
  open: KpiItem;
  close: KpiItem;
};

function formatValue(n: number): string {
  return n.toLocaleString("ko-KR");
}

/** 통합 카드 내부 단일 지표 (오픈/마감 각각). KpiCard의 축약판. */
function Metric({ item, label }: { item: KpiItem; label: string }) {
  const hasDelta = item.delta !== null;
  const isIncrease = hasDelta && item.delta! > 0;
  const isDecrease = hasDelta && item.delta! < 0;
  const isGood = isIncrease
    ? item.goodOnIncrease
    : isDecrease
      ? !item.goodOnIncrease
      : false;
  const arrow = isIncrease ? "▲" : isDecrease ? "▼" : "·";
  const toneClass =
    !hasDelta || item.delta === 0
      ? "text-muted"
      : isGood
        ? "text-vermilion"
        : "text-ink-soft";

  return (
    <div className="flex flex-1 flex-col gap-0.5">
      <div className="text-2xs text-muted">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums text-ink">
          {formatValue(item.value)}
        </span>
        <span className="text-2xs text-muted">{item.unit}</span>
      </div>
      {hasDelta ? (
        <div className={`flex items-center gap-1 text-xs ${toneClass}`}>
          <span>{arrow}</span>
          <span className="tabular-nums">{Math.abs(item.delta!)}</span>
          {item.deltaPct !== null ? (
            <span className="text-muted">
              ({item.deltaPct > 0 ? "+" : ""}
              {item.deltaPct}%)
            </span>
          ) : null}
        </div>
      ) : (
        <div className="text-xs text-muted">비교 불가</div>
      )}
    </div>
  );
}

/**
 * 서비스 오픈·마감 통합 카드 — 한 쌍의 지표를 한 카드 영역에 나란히 표시.
 * 데이터는 KPI 스냅샷의 service-open / service-close 두 항목을 그대로 사용.
 */
export function ServiceFlowCard({ open, close }: Props) {
  return (
    <div className="flex flex-col gap-1 border border-line-soft bg-situation-bg p-4">
      <div className="text-xs font-medium text-muted">서비스</div>
      <div className="flex gap-3">
        <Metric item={open} label="오픈" />
        <div className="w-px shrink-0 self-stretch bg-line-soft" />
        <Metric item={close} label="마감" />
      </div>
    </div>
  );
}
