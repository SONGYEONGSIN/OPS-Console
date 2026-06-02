"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * 사고보고 목록 — `승인 대기` 칩 (팀장 결재 큐 대체).
 *
 * `?report=pending` 으로 본인이 승인자인 pending_approval 경위서가 달린 사고만 필터.
 * 활성 시 ScopeChips 와 동일한 active/inactive 스타일(font-bold text-ink / text-muted).
 * 토글 — 활성 시 클릭하면 report 해제(전체로 복귀). ScopeChips 는 report 를 보존하므로
 * 이 칩이 유일한 해제 경로다.
 */
export function PendingApprovalChip() {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get("report") === "pending";

  const next = new URLSearchParams(params.toString());
  if (active) next.delete("report");
  else next.set("report", "pending");
  next.delete("page");
  const query = next.toString();
  const href = query ? `${pathname}?${query}` : pathname;

  return (
    <Link
      href={href}
      aria-label="경위서 승인 대기"
      aria-pressed={active}
      className={`relative px-3 py-1 text-sm transition-colors ${
        active ? "font-bold text-ink" : "text-muted hover:text-ink"
      }`}
    >
      승인 대기
      {active && (
        <span
          aria-hidden
          className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-vermilion"
        />
      )}
    </Link>
  );
}
