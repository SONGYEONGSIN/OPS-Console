"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ListSearch } from "@/components/common/ListSearch";
import { ListSelect } from "@/components/common/ListSelect";
import {
  MEETING_TYPES,
  MEETING_TYPE_LABELS,
  type MeetingType,
} from "@/features/meetings/schemas";

const DEBOUNCE_MS = 300;

/** ListSelect는 value===label인 string[]만 받으므로 라벨(한글)을 옵션으로 노출하고
 *  라벨↔type 역매핑으로 URL `?type=`엔 영문 type을 저장한다. */
const TYPE_LABEL_OPTIONS: readonly string[] = MEETING_TYPES.map(
  (t) => MEETING_TYPE_LABELS[t],
);
const LABEL_TO_TYPE = new Map<string, MeetingType>(
  MEETING_TYPES.map((t) => [MEETING_TYPE_LABELS[t], t]),
);

/**
 * meetings 페이지 — 유형 select(?type) + 검색 input(?q).
 * 본인 필터 chip과 페이지네이션은 별도 (ScopeChips / ListPagination).
 * contracts 패턴과 동일하나 select를 검색창 앞(왼쪽)에 배치한다.
 */
export function MeetingsControls() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");
  const typeParam = params.get("type") ?? "";
  const typeLabel =
    typeParam && MEETING_TYPE_LABELS[typeParam as MeetingType]
      ? MEETING_TYPE_LABELS[typeParam as MeetingType]
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
      <ListSelect
        value={typeLabel}
        onChange={(label) =>
          navigate({ type: LABEL_TO_TYPE.get(label) ?? null })
        }
        options={TYPE_LABEL_OPTIONS}
        placeholder="유형 전체"
        ariaLabel="유형 필터"
      />
      <ListSearch value={q} onChange={setQ} placeholder="제목·작성자 검색" />
    </div>
  );
}
