"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

type Props = {
  /** 현재 필터 적용된 row 총 수 (전체 칩 옆 표시) */
  total: number;
  /** mine 칩 라벨 (도메인별 — "내 서비스" / "내 계약" / "내 백업 요청") */
  mineLabel: string;
};

/**
 * 목록 페이지 — "전체 (N) | 내 X" 토글 chips. 모든 list 도메인 공통.
 *
 * URL `?mine=` 갱신으로 mutual exclusive. 도메인 page.tsx에서 mine=true 시
 * 서버 또는 클라이언트 filter 처리 (operator === me 비교 등).
 *
 * 사용 예 (services / contracts / 향후 도메인 동일):
 *   <ScopeChips total={total} mineLabel="내 서비스" />
 *   <ScopeChips total={total} mineLabel="내 계약" />
 */
export function ScopeChips({ total, mineLabel }: Props) {
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
        aria-label={mineLabel}
        aria-pressed={mine}
        onClick={() => go(true)}
        className={`relative cursor-pointer border-none bg-transparent px-3 py-1 text-sm transition-colors ${
          mine ? "font-bold text-ink" : "text-muted hover:text-ink"
        }`}
      >
        {mineLabel}
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
