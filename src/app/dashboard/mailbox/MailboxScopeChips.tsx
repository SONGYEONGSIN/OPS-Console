"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { MailboxScopeCounts } from "@/features/mailbox/triage";

const OPTIONS = [
  { key: "all", label: "전체", countKey: "all" },
  { key: "unreplied", label: "미회신", countKey: "unreplied" },
  { key: "today", label: "오늘", countKey: "today" },
  { key: "unread", label: "안읽음", countKey: "unread" },
] as const;

/**
 * 메일함 — 트리아지 범위 칩 (전체 / 미회신 / 오늘 / 안읽음). 기본 '전체'.
 * URL `?scope=` 갱신(SSR 호환). 기본값 all은 URL에서 생략. page 파라미터는 초기화.
 * 카운트는 서버에서 전체(검색 적용) 기준 산출해 prop으로 전달 — 페이지 한정 아님.
 */
export function MailboxScopeChips({ counts }: { counts: MailboxScopeCounts }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("scope") ?? "all";

  function go(next: string) {
    const p = new URLSearchParams(params.toString());
    if (next === "all") p.delete("scope");
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
