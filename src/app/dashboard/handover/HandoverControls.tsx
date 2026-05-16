"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ListSearch } from "@/components/common/ListSearch";
import { ListSelect } from "@/components/common/ListSelect";

const DEBOUNCE_MS = 300;

/** 작성상태 필터 — value는 status enum 또는 'none'(미작성) */
const STATUS_OPTIONS = ["none", "draft", "ready", "published"] as const;

export function HandoverControls() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const status = params.get("status") ?? "";

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
        placeholder="대학명·서비스명 검색"
        ariaLabel="인수인계 검색"
      />
      <ListSelect
        value={status}
        onChange={(v) => navigate({ status: v || null })}
        options={STATUS_OPTIONS}
        placeholder="작성상태 전체"
        ariaLabel="작성상태 필터"
      />
    </div>
  );
}
