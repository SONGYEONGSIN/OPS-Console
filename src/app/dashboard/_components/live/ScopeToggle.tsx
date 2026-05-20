"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

/**
 * ScopeToggle — 전체 / 내것 토글.
 * URL `?mine=true` 갱신. mutual exclusive.
 */
export function ScopeToggle({ mine }: { mine: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // 기본 mine=true. URL ?mine=false로만 전체 모드.
  function go(nextMine: boolean) {
    const next = new URLSearchParams(params.toString());
    if (nextMine) next.delete("mine");
    else next.set("mine", "false");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div
      role="group"
      aria-label="범위 토글"
      className="inline-flex border border-line bg-cream"
    >
      <button
        type="button"
        aria-pressed={!mine}
        onClick={() => go(false)}
        className={`cursor-pointer border-none px-3 py-1 text-xs transition-colors ${
          !mine ? "bg-ink text-cream font-bold" : "bg-transparent text-ink-soft hover:text-ink"
        }`}
      >
        전체
      </button>
      <button
        type="button"
        aria-pressed={mine}
        onClick={() => go(true)}
        className={`cursor-pointer border-none px-3 py-1 text-xs transition-colors ${
          mine ? "bg-ink text-cream font-bold" : "bg-transparent text-ink-soft hover:text-ink"
        }`}
      >
        내것
      </button>
    </div>
  );
}
