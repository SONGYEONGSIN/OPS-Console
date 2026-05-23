"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const TABS = [
  { key: "content", label: "인수인계 작성" },
  { key: "progress", label: "인수인계 진행" },
  { key: "history", label: "인수인계 확인" },
] as const;

export function HandoverTabs() {
  const params = useSearchParams();
  const active = params.get("tab") ?? "content";

  return (
    <div className="px-7">
      <div className="flex gap-1 border-b border-line">
      {TABS.map((t) => {
        const isActive = active === t.key;
        const href =
          t.key === "content"
            ? "/dashboard/handover"
            : `/dashboard/handover?tab=${t.key}`;
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
