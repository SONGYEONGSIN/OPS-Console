"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

/**
 * 정산 완료 여부 칩 (미완료 / 전체).
 *
 * 담당 칩(`ClosingStatusChips`)과 **다른 축**이라 파라미터를 따로 쓴다 —
 * `status` 는 담당, `done` 은 완료. 한 파라미터에 섞으면 '내 담당 · 미완료'
 * 같은 조합을 표현할 수 없다.
 *
 * 기본은 미완료다. 정산 화면은 남은 일을 보는 곳이고, 끝난 572건이 기본으로
 * 깔리면 무엇이 남았는지 읽히지 않는다.
 */
const OPTIONS = [
  { key: "open", label: "미완료" },
  { key: "all", label: "전체" },
] as const;

export function SettlementDoneChips() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("done") ?? "open";

  function go(next: string) {
    const p = new URLSearchParams(params.toString());
    if (next === "open") p.delete("done");
    else p.set("done", next);
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
