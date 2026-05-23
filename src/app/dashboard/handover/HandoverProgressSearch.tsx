"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ListSearch } from "@/components/common/ListSearch";

const DEBOUNCE_MS = 300;

type Props = {
  /** 접수구분 select 옵션 (페이지에서 distinct 추출해 전달). */
  applicationTypes?: string[];
};

/** 인수인계 진행 탭 — 대학명·서비스명 검색 + 접수구분 필터.
 *  status는 'ready' 고정이라 status filter 불필요. */
export function HandoverProgressSearch({ applicationTypes = [] }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const type = params.get("type") ?? "";

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
        placeholder="대학명·서비스 검색"
        ariaLabel="인수인계 진행 검색"
      />
      <select
        aria-label="접수구분 필터"
        value={type}
        onChange={(e) => navigate({ type: e.target.value || null })}
        className="border border-line bg-transparent px-3 py-2 text-sm text-ink outline-none focus:border-vermilion"
      >
        <option value="">접수구분 전체</option>
        {applicationTypes.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}
