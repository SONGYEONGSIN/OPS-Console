"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ListSearch } from "@/components/common/ListSearch";

const DEBOUNCE_MS = 300;

/**
 * 운영부 뉴스 페이지 — 제목 검색 input(?q).
 * 검색어 변경 시 300ms 디바운스 후 URL ?q set/delete + page 리셋.
 * 페이지네이션은 별도 (ListPagination).
 */
export function NewsControls() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");

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

  return (
    <div className="flex flex-wrap items-center gap-2 px-7 pt-3">
      <ListSearch value={q} onChange={setQ} placeholder="제목 검색" />
    </div>
  );
}
