"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const DEBOUNCE_MS = 300;

export function ServicesControls() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");
  const mine = params.get("mine") === "true";

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const id = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q.trim()) next.set("q", q.trim());
      else next.delete("q");
      next.delete("page");
      router.push(`${pathname}?${next.toString()}`);
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [q, pathname, params, router]);

  function toggleMine() {
    const next = new URLSearchParams(params.toString());
    if (mine) next.delete("mine");
    else next.set("mine", "true");
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-7 pt-3">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="대학명·서비스명 검색"
        className="w-full max-w-md rounded-md border border-faint bg-cream px-3 py-1.5 text-sm text-ink placeholder:text-muted focus:border-ink focus:outline-none"
      />
      <button
        type="button"
        aria-pressed={mine}
        onClick={toggleMine}
        className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
          mine
            ? "border-ink bg-ink text-cream"
            : "border-faint bg-transparent text-muted hover:text-ink"
        }`}
      >
        내 담당
      </button>
    </div>
  );
}
