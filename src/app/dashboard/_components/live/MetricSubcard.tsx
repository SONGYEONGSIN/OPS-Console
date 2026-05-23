type Props = {
  label: string;
  value: string | number;
  desc: string;
  active?: boolean;
};

const NUM_FORMATTER = new Intl.NumberFormat("ko-KR");

/** 중소 그룹박스 sub 카드. active=true면 value vermilion.
 *  number value는 ko-KR 천단위 구분으로 포맷(2,283), string은 그대로. */
export function MetricSubcard({ label, value, desc, active = false }: Props) {
  const valueColor = active ? "text-vermilion" : "text-ink";
  const displayValue = typeof value === "number" ? NUM_FORMATTER.format(value) : value;
  return (
    <div className="flex flex-col gap-1 border border-line-soft bg-washi-raised px-3.5 py-3 transition-colors hover:border-ink hover:bg-washi">
      <span className="text-xs font-semibold text-ink-muted">{label}</span>
      <span
        data-subcard-value
        className={`text-[26px] font-bold leading-tight tabular-nums ${valueColor}`}
      >
        {displayValue}
      </span>
      <span className="text-[11px] text-ink-muted">{desc}</span>
    </div>
  );
}
