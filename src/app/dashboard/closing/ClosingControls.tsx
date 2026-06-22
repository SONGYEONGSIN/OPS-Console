"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ListSearch } from "@/components/common/ListSearch";
import { ListSelect } from "@/components/common/ListSelect";

const DEBOUNCE_MS = 300;

/**
 * 서비스 마감 — 검색 input(?q, 대학·서비스·운영자) + 카테고리 셀렉트(?category).
 * contacts/services와 동일한 표준 controlsRow 구성. URL 기반(SSR 호환), 변경 시 page 초기화.
 */
export function ClosingControls({
  categories,
  months,
}: {
  categories: string[];
  months: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");
  const category = params.get("category") ?? "";
  const month = params.get("month") ?? "";

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
      <ListSearch
        value={q}
        onChange={setQ}
        placeholder="대학명·서비스명·운영자 검색"
      />
      <ListSelect
        value={category}
        onChange={(v) => navigate({ category: v || null })}
        options={categories}
        placeholder="카테고리 전체"
        ariaLabel="카테고리 필터"
      />
      <ListSelect
        value={month}
        onChange={(v) => navigate({ month: v || null })}
        options={months}
        placeholder="월 전체"
        ariaLabel="월 필터"
      />
    </div>
  );
}
