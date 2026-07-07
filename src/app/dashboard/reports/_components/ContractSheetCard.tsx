import type { KpiItem } from "@/features/reports/schemas";
import { completionRate } from "@/features/contracts/completion";

type Props = {
  item: KpiItem;
};

function formatValue(n: number): string {
  return n.toLocaleString("ko-KR");
}

/** 카드 내부 단일 시트 컬럼 — 라벨 + 완료/전체 건수 + 완료율. */
function SheetColumn({
  label,
  value,
  total,
  unit,
}: {
  label: string;
  value: number;
  total?: number;
  unit: string;
}) {
  const rate = total != null ? completionRate(value, total) : null;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <div className="truncate text-2xs text-muted">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums text-ink">
          {formatValue(value)}
        </span>
        {total != null ? (
          <span className="text-2xs text-muted">
            / {formatValue(total)}
            {unit}
          </span>
        ) : (
          <span className="text-2xs text-muted">{unit}</span>
        )}
      </div>
      {rate != null ? (
        <div className="truncate text-2xs text-muted">완료율 {rate}%</div>
      ) : null}
    </div>
  );
}

/**
 * 계약 체결 시트별 카드 — 시트(4년제/전문대)별 완료/전체 건수 + 완료율을
 * 세로 구분선으로 나눠 표시. ServiceFlowCard와 동일한 컬럼 스타일 + 1칸 너비.
 * breakdown이 있는 KPI 항목(contract) 전용.
 */
export function ContractSheetCard({ item }: Props) {
  const breakdown = item.breakdown ?? [];
  return (
    <div className="flex flex-col gap-1 border border-line-soft bg-situation-bg p-4">
      <div className="text-xs font-medium text-muted">{item.label}</div>
      <div className="flex gap-3">
        {breakdown.map((b, i) => (
          <div key={b.label} className="flex min-w-0 flex-1 gap-3">
            {i > 0 ? (
              <div className="w-px shrink-0 self-stretch bg-line-soft" />
            ) : null}
            <SheetColumn
              label={b.label}
              value={b.value}
              total={b.total}
              unit={item.unit}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
