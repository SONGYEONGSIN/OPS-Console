import type { ReactNode } from "react";
import { CountUp } from "../CountUp";
import { Sparkline } from "../Sparkline";

export type StageVariant = "soon" | "prog" | "done" | "settle";

export type StageCardProps = {
  label: string;
  tag: string;
  count: number | null;
  meta: ReactNode;
  variant: StageVariant;
  sparklineD?: string;
};

/** variant별 상단 accent + settle 줄무늬 셸 배경.
 *  settle은 백엔드 후속(셸) 단계 — count는 항상 null("—")로 비활성 표현. */
const VARIANT_CLASS: Record<StageVariant, string> = {
  soon: "border-t-[3px] border-t-sage",
  prog: "border-t-[3px] border-t-vermilion",
  done: "border-t-[3px] border-t-muted",
  // 일회성: settle 셸 단계 빗금(washi) 텍스처 — 토큰색만 사용, 임의값은 각도/패턴 폭뿐
  settle:
    "border-t-[3px] border-t-gold [background:repeating-linear-gradient(135deg,var(--cream),var(--cream)_8px,var(--washi-raised)_8px,var(--washi-raised)_10px)]",
};

/** ② 서비스 라이프사이클 단일 스테이지 카드 (v4 .stage).
 *  CountUp/Sparkline 재사용. count=null(주로 settle)이면 "—"(text-faint). */
export function StageCard({
  label,
  tag,
  count,
  meta,
  variant,
  sparklineD,
}: StageCardProps) {
  const sparkVariant = variant === "prog" ? "danger" : "neutral";
  return (
    <div
      className={`flex flex-col border border-line bg-cream px-3.5 py-3 ${VARIANT_CLASS[variant]}`}
    >
      <span className="self-end border border-line px-1.5 py-px text-3xs text-ink-soft">
        {tag}
      </span>
      <div className="text-xs font-bold text-muted">{label}</div>
      <div className="mt-1.5 mb-0.5 flex items-end justify-between gap-2">
        {count === null ? (
          <span className="text-3xl font-extrabold leading-none tabular-nums text-faint">
            —
          </span>
        ) : (
          <span className="text-3xl font-extrabold leading-none tabular-nums">
            <CountUp value={count} />
          </span>
        )}
        {sparklineD ? (
          <Sparkline d={sparklineD} variant={sparkVariant} />
        ) : null}
      </div>
      <div className="text-2xs text-muted">{meta}</div>
    </div>
  );
}
