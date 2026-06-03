"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * 사고보고 목록 — `승인 완료` 칩.
 *
 * `?report=approved` 으로 승인완료(approved) 경위서가 달린 사고만 필터.
 * 활성/비활성 스타일은 PendingApprovalChip 과 동일. 토글 — 활성 시 클릭하면 해제.
 */
export function ApprovedReportChip() {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get("report") === "approved";

  const next = new URLSearchParams(params.toString());
  if (active) next.delete("report");
  else next.set("report", "approved");
  next.delete("page");
  const query = next.toString();
  const href = query ? `${pathname}?${query}` : pathname;

  return (
    <Link
      href={href}
      aria-label="경위서 승인 완료"
      aria-pressed={active}
      className={`relative px-3 py-1 text-sm transition-colors ${
        active ? "font-bold text-ink" : "text-muted hover:text-ink"
      }`}
    >
      승인 완료
      {active && (
        <span
          aria-hidden
          className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-vermilion"
        />
      )}
    </Link>
  );
}
