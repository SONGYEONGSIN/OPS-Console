"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ListSearch } from "@/components/common/ListSearch";
import { ListSelect } from "@/components/common/ListSelect";
import { QUOTE_STATUS_VALUES, QUOTE_STATUS_LABEL } from "@/features/quotes/schemas";
import type { QuoteStatus } from "@/features/quotes/schemas";

const DEBOUNCE_MS = 300;

/** ListSelect는 value===label인 string[]만 받으므로 라벨(한글)을 옵션으로 노출하고
 *  라벨↔status 역매핑으로 URL `?status=`엔 영문 status를 저장한다. */
const STATUS_LABEL_OPTIONS: readonly string[] = QUOTE_STATUS_VALUES.map(
  (s) => QUOTE_STATUS_LABEL[s],
);
const LABEL_TO_STATUS = new Map<string, QuoteStatus>(
  QUOTE_STATUS_VALUES.map((s) => [QUOTE_STATUS_LABEL[s], s]),
);

/**
 * 견적서 페이지 — 고객 검색 input(?q) + 상태 select(?status).
 * MeetingsControls 패턴과 동일.
 */
export function QuotesControls() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");
  const statusParam = params.get("status") ?? "";
  const statusLabel =
    statusParam && QUOTE_STATUS_LABEL[statusParam as QuoteStatus]
      ? QUOTE_STATUS_LABEL[statusParam as QuoteStatus]
      : "";

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
      <ListSearch value={q} onChange={setQ} placeholder="고객·거래처 검색" />
      <ListSelect
        value={statusLabel}
        onChange={(label) =>
          navigate({ status: LABEL_TO_STATUS.get(label) ?? null })
        }
        options={STATUS_LABEL_OPTIONS}
        placeholder="상태 전체"
        ariaLabel="상태 필터"
      />
    </div>
  );
}
