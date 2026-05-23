type Props = { d: string; variant?: "danger" | "neutral" };

/** 미니 스파크라인 SVG (100×40). variant: danger(vermilion, 기본) | neutral(ink). */
export function Sparkline({ d, variant = "danger" }: Props) {
  const stroke = variant === "neutral" ? "stroke-ink" : "stroke-vermilion";
  return (
    <svg viewBox="0 0 100 40" className={`h-10 w-[100px] ${stroke}`} fill="none">
      <path d={d} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
