"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  REPORT_PERIOD_LABELS,
  type ReportPeriod,
} from "@/features/reports/schemas";

const ORDER: ReportPeriod[] = [
  "this-week",
  "this-month",
  "last-month",
  "quarter",
  "year",
];

/**
 * 분석보고서 기간 selector — 5 옵션 토글.
 * URL ?period= 로 상태 관리. 미지정 시 'this-month' 기본.
 * settings nav 톤(vermilion 강조) 차용 — 가로 button row.
 */
export function PeriodSelector() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = (searchParams.get("period") as ReportPeriod) ?? "this-month";

  function hrefFor(value: ReportPeriod): string {
    const params = new URLSearchParams();
    params.set("period", value);
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="기간 선택">
      {ORDER.map((p) => {
        const active = p === current;
        return (
          <Link
            key={p}
            href={hrefFor(p)}
            aria-current={active ? "page" : undefined}
            className={`border px-3 py-1.5 text-xs ${
              active
                ? "border-vermilion bg-vermilion text-cream"
                : "border-line bg-transparent text-ink hover:border-vermilion hover:text-vermilion"
            }`}
          >
            {REPORT_PERIOD_LABELS[p]}
          </Link>
        );
      })}
    </div>
  );
}
