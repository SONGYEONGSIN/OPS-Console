"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ListSearch } from "@/components/common/ListSearch";
import { ListSelect } from "@/components/common/ListSelect";

const DEBOUNCE_MS = 300;

type Props = {
  categoryOptions: readonly string[];
  universityTypeOptions: readonly string[];
  admissionTypeOptions: readonly string[];
};

/**
 * 개발 탭 controlsRow — 검색 + 필터(카테고리/대학구분/접수구분, 테스트 탭과 동일·지역 제외).
 * searchParam 구동, 변경 시 page 리셋.
 */
export function DevControlSearch({
  categoryOptions,
  universityTypeOptions,
  admissionTypeOptions,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function navigate(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const id = setTimeout(() => navigate({ q: q.trim() || null }), DEBOUNCE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-wrap items-center gap-2 px-7 pt-3">
      <ListSearch
        value={q}
        onChange={setQ}
        placeholder="대학명·서비스명 검색"
        ariaLabel="개발 탭 검색"
      />
      <ListSelect
        value={params.get("category") ?? ""}
        onChange={(v) => navigate({ category: v || null })}
        options={categoryOptions}
        placeholder="카테고리 전체"
        ariaLabel="카테고리 필터"
      />
      <ListSelect
        value={params.get("universityType") ?? ""}
        onChange={(v) => navigate({ universityType: v || null })}
        options={universityTypeOptions}
        placeholder="대학구분 전체"
        ariaLabel="대학구분 필터"
      />
      <ListSelect
        value={params.get("admissionType") ?? ""}
        onChange={(v) => navigate({ admissionType: v || null })}
        options={admissionTypeOptions}
        placeholder="접수구분 전체"
        ariaLabel="접수구분 필터"
      />
    </div>
  );
}
