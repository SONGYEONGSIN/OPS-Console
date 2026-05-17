"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ListSearch } from "@/components/common/ListSearch";

const DEBOUNCE_MS = 300;

const DOMAINS = [
  { value: "", label: "도메인 전체" },
  { value: "handover", label: "인수인계" },
  { value: "incidents", label: "사고 보고" },
  { value: "services", label: "서비스" },
  { value: "contacts", label: "대학 연락처" },
  { value: "contracts", label: "계약" },
];

const LEVELS = [
  { value: "", label: "레벨 전체" },
  { value: "INFO", label: "INFO" },
  { value: "WARN", label: "WARN" },
  { value: "ERROR", label: "ERROR" },
];

export function WorklogControls() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");
  const domain = params.get("domain") ?? "";
  const level = params.get("level") ?? "";

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
        placeholder="활동 메시지·대상 검색"
        ariaLabel="활동 검색"
      />
      <select
        aria-label="도메인 필터"
        value={domain}
        onChange={(e) => navigate({ domain: e.target.value || null })}
        className="border border-line bg-transparent px-3 py-2 text-sm text-ink outline-none focus:border-vermilion"
      >
        {DOMAINS.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>
      <select
        aria-label="레벨 필터"
        value={level}
        onChange={(e) => navigate({ level: e.target.value || null })}
        className="border border-line bg-transparent px-3 py-2 text-sm text-ink outline-none focus:border-vermilion"
      >
        {LEVELS.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
