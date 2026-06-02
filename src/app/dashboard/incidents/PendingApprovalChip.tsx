"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * 사고보고 목록 — `승인 대기` 칩 (팀장 결재 큐 대체).
 *
 * `?report=pending` 으로 본인이 승인자인 pending_approval 경위서가 달린 사고만 필터.
 * 활성 시 ScopeChips 와 동일한 active/inactive 스타일(font-bold text-ink / text-muted).
 * 비활성 시(ScopeChips 전체/내사고 클릭)에는 ScopeChips href 가 report 를 보존하지
 * 않으므로 자연히 칩이 풀린다.
 */
export function PendingApprovalChip() {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get("report") === "pending";

  const next = new URLSearchParams(params.toString());
  next.set("report", "pending");
  next.delete("page");
  const href = `${pathname}?${next.toString()}`;

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
