"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  HANDOVER_CATEGORIES,
  type HandoverCategoryKey,
} from "@/features/handover/categories";

export function CategoryNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = (params.get("cat") ?? "contract") as HandoverCategoryKey;

  return (
    <nav aria-label="카테고리" className="border-r border-line-soft py-4">
      {HANDOVER_CATEGORIES.map((c) => {
        const isActive = c.key === active;
        const href = `${pathname}?cat=${c.key}`;
        return (
          <Link
            key={c.key}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-2 px-6 py-3 text-sm ${
              isActive
                ? "bg-vermilion/10 font-semibold text-vermilion"
                : "text-ink-soft hover:bg-washi-raised hover:text-ink"
            }`}
          >
            <span className={isActive ? "text-vermilion" : "text-muted"}>
              {isActive ? "⊙" : "·"}
            </span>
            {c.label}
          </Link>
        );
      })}
    </nav>
  );
}
