"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ListSearch } from "@/components/common/ListSearch";
import { ListSelect } from "@/components/common/ListSelect";

const DEBOUNCE_MS = 300;

const STATUS_OPTIONS = ["미처리", "처리중", "처리완료", "보류"] as const;
const DEPARTMENT_OPTIONS = [
  "운영부-운영1팀",
  "운영부-운영2팀",
] as const;

type Props = {
  /** 학년도 selector 후보 — page에서 현 학년도 ±5 계산해 주입 */
  yearOptions: readonly string[];
  /** 현 학년도 default — params.year 미존재 시 selected */
  defaultYear: number;
};

/**
 * incidents 페이지 — 학년도/상태/부서 select + 사고 검색.
 * services/contacts 패턴 mirror.
 */
export function IncidentsControls({ yearOptions, defaultYear }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");
  const year = params.get("year") ?? String(defaultYear);
  const status = params.get("status") ?? "";
  const department = params.get("department") ?? "";

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
        placeholder="제목·대학·경위·담당자 검색"
        ariaLabel="사고 검색"
      />
      <ListSelect
        value={year}
        onChange={(v) => navigate({ year: v || null })}
        options={yearOptions}
        ariaLabel="학년도"
      />
      <ListSelect
        value={status}
        onChange={(v) => navigate({ status: v || null })}
        options={STATUS_OPTIONS}
        placeholder="현재상황 전체"
        ariaLabel="현재상황 필터"
      />
      <ListSelect
        value={department}
        onChange={(v) => navigate({ department: v || null })}
        options={DEPARTMENT_OPTIONS}
        placeholder="담당부서 전체"
        ariaLabel="담당부서 필터"
      />
    </div>
  );
}
