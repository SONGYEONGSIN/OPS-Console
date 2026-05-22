"use client";

import Link from "next/link";
import { CountUp } from "./CountUp";

type Props = {
  label: string;
  count: number | null;
  countSub: string;
  href: string;
};

/** 라벨↑ + 큰 숫자(라벨 폰트에 비례, em-기반)↓ + countSub.
 *  count=null이면 — 표시(카운트업 없음). 클릭→href. */
export function KpiTile({ label, count, countSub, href }: Props) {
  return (
    <Link
      href={href}
      className="group block border border-line bg-cream px-4 py-3 transition-colors hover:bg-washi-raised"
    >
      <div className="font-mono text-2xs uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
      {/* 숫자 크기는 라벨 폰트 사이즈(text-2xs)에 em-비례. fixed text-* 미사용. */}
      <div
        data-kpi-number
        className="mt-1 text-[3.2em] font-light leading-none text-ink"
      >
        {count === null ? "—" : <CountUp value={count} />}
      </div>
      <div className="mt-1 text-2xs text-muted">{countSub}</div>
    </Link>
  );
}
