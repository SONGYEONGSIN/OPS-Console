"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const TABS = [
  { key: "test", label: "테스트" },
  { key: "dev", label: "개발" },
] as const;

export function DevTestTabs() {
  const params = useSearchParams();
  const active = params.get("tab") ?? "test";

  return (
    <div className="px-7">
      <div className="flex gap-1 border-b border-line">
        {TABS.map((t) => {
          const isActive = active === t.key;
          const href =
            t.key === "test"
              ? "/dashboard/dev-test"
              : `/dashboard/dev-test?tab=${t.key}`;
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
