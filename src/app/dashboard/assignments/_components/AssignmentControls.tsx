"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ListSearch } from "@/components/common/ListSearch";
import { ListSelect } from "@/components/common/ListSelect";

const DEBOUNCE_MS = 300;

type Props = {
  /** 대분류(universityType) 옵션 — 데이터에서 unique 추출하여 page가 주입 */
  universityTypeOptions: readonly string[];
};

/**
 * 대학배정 탭 — 검색 input (대학명 · 담당자명 양방향, ?q debounce) + 대분류 select (?universityType).
 * 페이지가 ?q는 matchesAssignmentQuery, ?universityType은 row.universityType 정확 매칭으로 필터.
 */
export function AssignmentControls({ universityTypeOptions }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");
  const universityType = params.get("universityType") ?? "";

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
        placeholder="대학명·담당자명 검색"
      />
      <ListSelect
        value={universityType}
        onChange={(v) => navigate({ universityType: v || null })}
        options={universityTypeOptions}
        placeholder="대분류 전체"
        ariaLabel="대분류 필터"
      />
    </div>
  );
}
