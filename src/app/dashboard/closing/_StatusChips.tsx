"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

const OPTIONS = [
  { key: "all", label: "전체" },
  { key: "mine", label: "내 마감" },
  { key: "open", label: "진행중" },
] as const;

/**
 * 서비스 마감 — 마감여부 필터 칩 (전체 / 내 마감 / 진행중). 기본 '전체'.
 * URL `?status=` 갱신(SSR 호환). 기본값 all은 URL에서 생략. page 파라미터는 초기화.
 * '내 마감'(mine) = 본인 담당(operator_name 일치).
 */
export function ClosingStatusChips() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("status") ?? "all";

  function go(next: string) {
    const p = new URLSearchParams(params.toString());
    if (next === "all") p.delete("status");
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
            {o.label}
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
