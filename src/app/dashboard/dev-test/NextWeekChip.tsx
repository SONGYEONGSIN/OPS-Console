"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { WeekRange } from "@/features/closing/next-week";

/** `2026-09-14` → `9/14` */
function shortDay(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number);
  return `${m}/${d}`;
}

/**
 * '차주오픈' 토글 — 다음 주(월~일)에 접수를 여는 서비스만 남긴다.
 *
 * **전체/내 대학 위에 한 겹 더 거는 스위치다.** 셋을 한 줄 택일로 두면
 * '내 대학 중 차주 오픈'을 볼 길이 없는데, 운영자가 가장 자주 볼 조합이 그것이다.
 *
 * 범위는 서버가 계산해 넘긴다. 브라우저에서 다시 계산하면 자정 무렵에
 * 칩 글자와 목록이 서로 다른 주를 가리킬 수 있다.
 */
export function NextWeekChip({ range }: { range: WeekRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const on = params.get("week") === "next";

  function toggle() {
    const next = new URLSearchParams(params.toString());
    if (on) next.delete("week");
    else next.set("week", "next");
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="ml-1 inline-flex border-l border-line-soft pl-1">
      <button
        type="button"
        aria-pressed={on}
        onClick={toggle}
        className={`relative cursor-pointer border-none bg-transparent px-3 py-1 text-sm transition-colors ${
          on ? "font-bold text-ink" : "text-muted hover:text-ink"
        }`}
      >
        차주오픈
        <span className="ml-1 text-2xs font-normal tabular-nums text-muted">
          {`${shortDay(range.startYmd)}~${shortDay(range.endYmd)}`}
        </span>
        {on && (
          <span
            aria-hidden
            className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-vermilion"
          />
        )}
      </button>
    </div>
  );
}
