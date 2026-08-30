"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const TABS = [
  { key: "assignments", label: "개인 평가" },
  { key: "org-goals", label: "조직 목표" },
] as const;

/**
 * 성과리포트 탭 — 개인 평가 / 조직 목표.
 *
 * 사이드바에 항목을 새로 두지 않는다. 성과리포트가 이미 `adminOnly` 라
 * 탭으로 두면 권한이 저절로 맞고, 목표와 평가가 한 메뉴에 있는 게 맞다.
 */
export function OutcomesTabs() {
  const params = useSearchParams();
  const active = params.get("tab") ?? "assignments";

  return (
    <div className="px-7">
      <div className="flex gap-1 border-b border-line">
        {TABS.map((t) => {
          const isActive = active === t.key;
          const href =
            t.key === "assignments"
              ? "/dashboard/outcomes"
              : `/dashboard/outcomes?tab=${t.key}`;
          return (
            <Link
              key={t.key}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`-mb-px px-4 py-2 text-sm ${
                isActive
                  ? "border-b-2 border-vermilion font-semibold text-vermilion"
                  : "border-b-2 border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
