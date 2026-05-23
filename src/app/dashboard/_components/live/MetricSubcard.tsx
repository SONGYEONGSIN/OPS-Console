import { CountUp } from "./CountUp";

type Props = {
  label: string;
  value: string | number;
  desc: string;
  active?: boolean;
};

/** 중소 그룹박스 sub 카드. active=true면 value vermilion.
 *  - number value: CountUp으로 0→value 카운트업 + ko-KR 천단위 구분
 *  - string value: 그대로 표시
 *  - desc: KPI footer와 동일 흐린 톤(text-muted) + 점선 구분선 */
export function MetricSubcard({ label, value, desc, active = false }: Props) {
  const valueColor = active ? "text-vermilion" : "text-ink";
  return (
    <div className="flex flex-col gap-1 border border-line-soft bg-washi-raised px-3.5 py-3 transition-colors hover:border-ink hover:bg-washi">
      <span className="text-xs font-semibold text-ink-muted">{label}</span>
      <span
        data-subcard-value
        className={`text-[26px] font-bold leading-tight tabular-nums ${valueColor}`}
      >
        {typeof value === "number" ? <CountUp value={value} /> : value}
      </span>
      <span className="mt-1 block border-t border-dashed border-line-soft pt-1 text-[11px] text-muted">
        {desc}
      </span>
    </div>
  );
}
