"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { chipOptions, type ClosingScope } from "@/features/closing/scope";

export type ClosingCounts = { all: number; mine: number };

/**
 * 서비스 목록 필터 칩 (전체 / 내 것). 기본 '내 것'.
 *
 * **마감여부 칩은 없다.** 메뉴가 이미 범위를 정한다 — 배포·운영은 진행중, 서비스마감은
 * 마감된 것. 그래서 '전체'는 그 메뉴가 맡은 범위의 전체를 뜻한다.
 *
 * URL `?status=` 갱신(SSR 호환). 기본값 mine은 URL에서 생략. page 파라미터는 초기화.
 * 카운트는 서버에서 전체(검색·카테고리 적용) 기준 산출해 prop으로 전달 — 페이지 한정 아님.
 */
export function ClosingStatusChips({
  counts,
  scope,
}: {
  counts: ClosingCounts;
  scope: ClosingScope;
}) {
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
      {chipOptions(scope).map((o) => {
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
            {o.label} ({counts[o.key]})
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
