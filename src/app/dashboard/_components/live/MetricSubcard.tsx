import { CountUp } from "./CountUp";

type Props = {
  label: string;
  value: string | number | { num: number; den: number };
  desc: string;
  active?: boolean;
  /** 값 영역 hover 시 표시할 도움말 문구. 전달 시 peer-hover 기반 커스텀 tooltip 표시. */
  valueHint?: string;
};

/** 중소 그룹박스 sub 카드. active=true면 value vermilion.
 *  - number value: CountUp으로 0→value 카운트업 + ko-KR 천단위 구분
 *  - {num, den} fraction value: 두 CountUp을 " / " 로 연결 (양쪽 모두 카운트업 + 천단위)
 *  - string value: 그대로 표시
 *  - desc: KPI footer와 동일 흐린 톤(text-muted) + 점선 구분선
 *  - valueHint: value span에 peer + cursor-help, sibling tooltip이 peer-hover로 표시 */
export function MetricSubcard({
  label,
  value,
  desc,
  active = false,
  valueHint,
}: Props) {
  const valueColor = active ? "text-vermilion" : "text-ink";
  const valueContent =
    typeof value === "number" ? (
      <CountUp value={value} />
    ) : typeof value === "object" ? (
      <>
        <CountUp value={value.num} /> / <CountUp value={value.den} />
      </>
    ) : (
      value
    );
  return (
    <div className="flex flex-col gap-1 border border-line-soft bg-washi-raised px-3.5 py-3 transition-colors hover:border-ink hover:bg-washi">
      <span className="text-xs font-semibold text-ink-muted">{label}</span>
      {valueHint ? (
        <span className="relative inline-block">
          <span
            data-subcard-value
            className={`peer cursor-help whitespace-nowrap text-[26px] font-bold leading-tight tabular-nums ${valueColor}`}
          >
            {valueContent}
          </span>
          <span
            data-subcard-tooltip
            role="tooltip"
            className="pointer-events-none absolute left-0 top-full z-20 mt-1.5 hidden w-max max-w-[260px] whitespace-normal border border-ink bg-cream px-2 py-1.5 text-[11px] font-normal leading-snug text-ink peer-hover:block"
          >
            {valueHint}
          </span>
        </span>
      ) : (
        <span
          data-subcard-value
          className={`whitespace-nowrap text-[26px] font-bold leading-tight tabular-nums ${valueColor}`}
        >
          {valueContent}
        </span>
      )}
      <span className="mt-1 block border-t border-dashed border-line-soft pt-1 text-[11px] text-muted">
        {desc}
      </span>
    </div>
  );
}
