"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ListSearch } from "@/components/common/ListSearch";

const DEBOUNCE_MS = 300;

/**
 * 인수인계 확인 탭 — 검색(대학명·서비스명) + 진행상태 필터.
 * 작성 탭(HandoverControls)과 동일한 형식. status는 handover_progress enum
 * (in_progress/completed/cancelled)이라 native select 직접 사용.
 */
export function HandoverHistoryControls() {
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
        placeholder="대학명·서비스 검색"
        ariaLabel="인수인계 확인 검색"
      />
      <select
        aria-label="진행상태 필터"
        value={status}
        onChange={(e) => navigate({ status: e.target.value || null })}
        className="border border-line bg-transparent px-3 py-2 text-sm text-ink outline-none focus:border-vermilion"
      >
        <option value="">진행상태 전체</option>
        <option value="in_progress">진행 중</option>
        <option value="completed">완료</option>
        <option value="cancelled">취소</option>
      </select>
    </div>
  );
}
