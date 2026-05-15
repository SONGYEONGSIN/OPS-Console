"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ListSearch } from "@/components/common/ListSearch";
import { ListSelect } from "@/components/common/ListSelect";
import { CONTRACT_SHEETS } from "@/features/contracts/schemas";

const DEBOUNCE_MS = 300;

/**
 * contracts 페이지 — 검색 input(?q) + 시트 select(?sheet).
 * 본인 필터 chip과 페이지네이션은 별도 (ScopeChips / ListPagination).
 */
export function ContractsControls() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");
  const sheet = params.get("sheet") ?? "";

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
        placeholder="대학명·넘버링 검색"
      />
      <ListSelect
        value={sheet}
        onChange={(v) => navigate({ sheet: v || null })}
        options={CONTRACT_SHEETS}
        placeholder="시트 전체"
        ariaLabel="시트 필터"
      />
    </div>
  );
}
