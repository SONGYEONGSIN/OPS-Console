"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export type ClosingCounts = { all: number; mine: number; open: number };

const OPTIONS = [
  { key: "all", label: "전체", countKey: "all" },
  { key: "mine", label: "내 마감", countKey: "mine" },
  { key: "open", label: "진행중", countKey: "open" },
] as const;

/**
 * 서비스 마감 — 마감여부 필터 칩 (전체 / 내 마감 / 진행중). 기본 '내 마감'.
 * URL `?status=` 갱신(SSR 호환). 기본값 mine은 URL에서 생략. page 파라미터는 초기화.
 * '내 마감'(mine) = 본인 담당(operator_name 일치).
 * 카운트는 서버에서 전체(검색·카테고리 적용) 기준 산출해 prop으로 전달 — 페이지 한정 아님.
 */
export function ClosingStatusChips({ counts }: { counts: ClosingCounts }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("status") ?? "mine";

  function go(next: string) {
    const p = new URLSearchParams(params.toString());
    if (next === "mine") p.delete("status");
    else p.set("status", next);
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
