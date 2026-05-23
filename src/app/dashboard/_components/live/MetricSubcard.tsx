type Props = {
  label: string;
  value: string | number;
  desc: string;
  active?: boolean;
};

/** 중소 그룹박스 sub 카드. active=true면 value vermilion. */
export function MetricSubcard({ label, value, desc, active = false }: Props) {
  const valueColor = active ? "text-vermilion" : "text-ink";
  return (
    <div className="flex flex-col gap-1 border border-line-soft bg-washi-raised px-3.5 py-3 transition-colors hover:border-ink hover:bg-washi">
      <span className="text-xs font-semibold text-ink-muted">{label}</span>
      <span
        data-subcard-value
        className={`text-[26px] font-bold leading-tight tabular-nums ${valueColor}`}
      >
        {value}
      </span>
      <span className="text-[11px] text-ink-muted">{desc}</span>
    </div>
  );
}
