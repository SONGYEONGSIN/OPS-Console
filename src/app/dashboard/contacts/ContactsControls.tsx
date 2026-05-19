"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ListSearch } from "@/components/common/ListSearch";
import { ListSelect } from "@/components/common/ListSelect";

const DEBOUNCE_MS = 300;

// 1차 PR — 하드코딩 옵션. 실 데이터 분포 후 follow-up에서 distinct fetch 또는 enum check 도입.
const JOB_ROLE_OPTIONS = ["실무자", "관리자"] as const;
const MANAGEMENT_GRADE_OPTIONS = ["A", "B", "C", "D"] as const;
const RELATIONSHIP_GRADE_OPTIONS = ["우호적", "보통", "주의"] as const;
const CUSTOMER_ACTIVE_OPTIONS = ["재직", "타부서 이동"] as const;

/**
 * contacts 페이지 — 검색 input(?q) + 3 필터 select (직책 / 관리등급 / 관계등급).
 * 대학명은 검색 input에서 OR 매칭 (free text라 select 부적합).
 */
export function ContactsControls() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");
  const jobRole = params.get("jobRole") ?? "";
  const managementGrade = params.get("managementGrade") ?? "";
  const relationshipGrade = params.get("relationshipGrade") ?? "";
  const customerActive = params.get("customerActive") ?? "";

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
        placeholder="고객명·대학명 검색"
      />
      <ListSelect
        value={jobRole}
        onChange={(v) => navigate({ jobRole: v || null })}
        options={JOB_ROLE_OPTIONS}
        placeholder="직책 전체"
        ariaLabel="직책 필터"
      />
      <ListSelect
        value={managementGrade}
        onChange={(v) => navigate({ managementGrade: v || null })}
        options={MANAGEMENT_GRADE_OPTIONS}
        placeholder="관리등급 전체"
        ariaLabel="관리 등급 필터"
      />
      <ListSelect
        value={relationshipGrade}
        onChange={(v) => navigate({ relationshipGrade: v || null })}
        options={RELATIONSHIP_GRADE_OPTIONS}
        placeholder="관계등급 전체"
        ariaLabel="관계 등급 필터"
      />
      <ListSelect
        value={customerActive}
        onChange={(v) => navigate({ customerActive: v || null })}
        options={CUSTOMER_ACTIVE_OPTIONS}
        placeholder="재직 상태 전체"
        ariaLabel="재직 상태 필터"
      />
    </div>
  );
}
