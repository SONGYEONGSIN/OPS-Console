"use client";

import { useEffect, useState } from "react";
import { CountUp } from "./CountUp";

type Props = {
  label: string;
  trend: string;
  trendDanger?: boolean;
  count: number;
  numberDanger?: boolean;
  footer: string;
  right?: React.ReactNode;
  /** 마운트 후 카운트업 시작까지 딜레이(ms). staggered 진입에 사용. */
  delayMs?: number;
};

/** 대형 KPI 카드 — label + trend tag / 큰 숫자(카운트업) + 우측 슬롯 / dashed footer.
 *  hover: -translate-y-0.5 + shadow-sm. */
export function KpiCardLarge({
  label,
  trend,
  trendDanger = false,
  count,
  numberDanger = false,
  footer,
  right,
  delayMs = 0,
}: Props) {
  const [active, setActive] = useState(delayMs === 0);

  useEffect(() => {
    if (delayMs === 0) return;
    const id = setTimeout(() => setActive(true), delayMs);
    return () => clearTimeout(id);
  }, [delayMs]);

  const numberColor = numberDanger ? "text-vermilion" : "text-ink";
  const trendColor = trendDanger
    ? "border-vermilion text-vermilion"
    : "border-ink text-ink-soft";

  return (
    <div className="flex min-h-[140px] flex-col justify-between border border-ink bg-washi-raised p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <span className="text-[13px] font-bold tracking-[-0.01em] text-ink-soft">{label}</span>
        <span
          data-trend-tag
          className={`border bg-cream px-1.5 py-0.5 text-[11px] font-bold ${trendColor}`}
        >
          {trend}
        </span>
      </div>
      <div className="flex items-end justify-between">
        <span
          data-kpi-number
          className={`text-[48px] font-extrabold leading-none tabular-nums ${numberColor}`}
        >
          <CountUp value={active ? count : 0} />
        </span>
        {right ?? null}
      </div>
      <div className="mt-3 border-t border-dashed border-line-soft pt-2 text-xs text-muted">
        {footer}
      </div>
    </div>
  );
}
