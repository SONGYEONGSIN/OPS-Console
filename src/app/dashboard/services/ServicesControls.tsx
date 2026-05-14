"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  UNIVERSITY_TYPE_OPTIONS,
  CATEGORY_OPTIONS,
} from "@/features/services/constants";

const DEBOUNCE_MS = 300;

/**
 * services 페이지 — 검색 input + 대학구분·카테고리 필터 select.
 * 본인 필터 칩과 페이지네이션은 별도 컴포넌트(ServicesMineChip / ServicesPagination).
 */
export function ServicesControls() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");
  const universityType = params.get("universityType") ?? "";
  const category = params.get("category") ?? "";

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

  function navigate(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
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
      <select
        aria-label="대학구분 필터"
        value={universityType}
        onChange={(e) => navigate({ universityType: e.target.value || null })}
        className="rounded-md border border-faint bg-cream px-2 py-1.5 text-sm text-ink"
      >
        <option value="">대학구분 전체</option>
        {UNIVERSITY_TYPE_OPTIONS.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <select
        aria-label="카테고리 필터"
        value={category}
        onChange={(e) => navigate({ category: e.target.value || null })}
        className="rounded-md border border-faint bg-cream px-2 py-1.5 text-sm text-ink"
      >
        <option value="">카테고리 전체</option>
        {CATEGORY_OPTIONS.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
