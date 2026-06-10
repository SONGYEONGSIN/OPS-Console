"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export type ReceivablesCounts = {
  all: number;
  mine: number;
  active: number;
  approved: number;
};

const OPTIONS = [
  { key: "all", label: "전체", countKey: "all" },
  { key: "mine", label: "내 채권", countKey: "mine" },
  { key: "active", label: "미수", countKey: "active" },
  { key: "approved", label: "수금", countKey: "approved" },
] as const;

/**
 * 미수채권 — 범위 칩 (전체 / 내 채권 / 미수 / 수금). 기본 '내 채권'.
 * URL `?scope=` 갱신(SSR 호환, 서버 필터). 기본값 mine은 URL에서 생략. page 초기화.
 * 카운트는 서버에서 전체(검색 적용) 데이터 기준으로 산출해 prop으로 전달 — 페이지 한정 아님.
 */
export function ReceivablesScopeChips({
  counts,
}: {
  counts: ReceivablesCounts;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("scope") ?? "mine";

  function go(next: string) {
    const p = new URLSearchParams(params.toString());
    if (next === "mine") p.delete("scope");
    else p.set("scope", next);
    p.delete("page");
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="inline-flex">
      {OPTIONS.map((o) => {
        const active = current === o.key;
        return (
          <button
            key={o.key}
            type="button"
            aria-label={o.label}
            aria-pressed={active}
            onClick={() => go(o.key)}
            className={`relative cursor-pointer border-none bg-transparent px-3 py-1 text-sm transition-colors ${
              active ? "font-bold text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {o.label} ({counts[o.countKey]})
            {active && (
              <span
                aria-hidden
                className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-vermilion"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
