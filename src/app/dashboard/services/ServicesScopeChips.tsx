"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

type Props = {
  /** 현재 필터 적용된 row 총 수 (전체 칩 옆 표시) */
  total: number;
};

/**
 * services 페이지 — ListPattern filter chip 영역의 "전체 (N) | 내 서비스" 토글.
 * URL ?mine= 갱신으로 mutual exclusive 상태 유지.
 * SERVICES_FILTERS는 빈 배열로 두어 ListPattern 내부의 status 기반 칩 렌더링을
 * 비활성화하고 이 컴포넌트가 단독으로 chip 영역을 책임진다.
 */
export function ServicesScopeChips({ total }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const mine = params.get("mine") === "true";

  function go(nextMine: boolean) {
    const next = new URLSearchParams(params.toString());
    if (nextMine) next.set("mine", "true");
    else next.delete("mine");
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <>
      <button
        type="button"
        aria-label="전체"
        aria-pressed={!mine}
        onClick={() => go(false)}
        className={`relative cursor-pointer border-none bg-transparent px-3 py-1 text-sm transition-colors ${
          !mine ? "font-bold text-ink" : "text-muted hover:text-ink"
        }`}
      >
        전체 ({total})
        {!mine && (
          <span
            aria-hidden
            className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-vermilion"
          />
        )}
      </button>
      <button
        type="button"
        aria-label="내 서비스"
        aria-pressed={mine}
        onClick={() => go(true)}
        className={`relative cursor-pointer border-none bg-transparent px-3 py-1 text-sm transition-colors ${
          mine ? "font-bold text-ink" : "text-muted hover:text-ink"
        }`}
      >
        내 서비스
        {mine && (
          <span
            aria-hidden
            className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-vermilion"
          />
        )}
      </button>
    </>
  );
}
