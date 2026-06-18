"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  setMyEntertestAccount,
  type EntertestActionState,
} from "@/features/entertest/actions";
import { ListSearch } from "@/components/common/ListSearch";
import { ListSelect } from "@/components/common/ListSelect";

const DEBOUNCE_MS = 300;

type Props = {
  myAccount: string | null;
  categoryOptions: readonly string[];
  regionOptions: readonly string[];
  universityTypeOptions: readonly string[];
  admissionTypeOptions: readonly string[];
};

/**
 * dev-test controlsRow — 상단 전역 바.
 * 좌: 테스트 계정 등록/수정(server action). 우: 검색 + 4 속성 필터(searchParam 구동).
 */
export function DevTestControls({
  myAccount,
  categoryOptions,
  regionOptions,
  universityTypeOptions,
  admissionTypeOptions,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [acctState, acctAction, acctPending] = useActionState<
    EntertestActionState,
    FormData
  >(setMyEntertestAccount, undefined);

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

  // 검색 debounce → searchParam
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const id = setTimeout(() => navigate({ q: q.trim() || null }), DEBOUNCE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-col gap-3 border-b border-line-soft bg-paper px-4 py-3">
      {/* 계정 바 */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-ink">테스트 계정</span>
        {myAccount ? (
          <span className="text-xs text-ink-soft">
            등록된 계정:{" "}
            <span className="font-semibold text-ink">{myAccount}</span> (ID=PW
            동일)
          </span>
        ) : (
          <span className="text-xs font-bold text-vermilion">
            테스트 계정이 등록되지 않았습니다. 본인 계정을 등록하세요.
          </span>
        )}
        <form action={acctAction} className="flex items-center gap-2">
          <input
            name="account"
            defaultValue={myAccount ?? ""}
            placeholder="jt29001"
            className="border border-line bg-cream px-2 py-1 text-xs text-ink transition-colors focus:border-ink focus:bg-white"
          />
          <button
            type="submit"
            disabled={acctPending}
            className="cursor-pointer border border-line bg-paper px-3 py-1 text-xs text-ink transition-colors hover:border-vermilion hover:text-vermilion disabled:opacity-50"
          >
            {myAccount ? "수정" : "등록"}
          </button>
          {acctState && (
            <span
              className={`text-2xs ${acctState.ok ? "text-ink-soft" : "text-vermilion"}`}
            >
              {acctState.message}
            </span>
          )}
        </form>
      </div>

      {/* 검색 + 필터 */}
      <div className="flex flex-wrap items-center gap-2">
        <ListSearch
          value={q}
          onChange={setQ}
          placeholder="대학명·서비스명 검색"
        />
        <ListSelect
          value={params.get("category") ?? ""}
          onChange={(v) => navigate({ category: v || null })}
          options={categoryOptions}
          placeholder="카테고리 전체"
          ariaLabel="카테고리 필터"
        />
        <ListSelect
          value={params.get("region") ?? ""}
          onChange={(v) => navigate({ region: v || null })}
          options={regionOptions}
          placeholder="지역 전체"
          ariaLabel="지역 필터"
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
    </div>
  );
}
