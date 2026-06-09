"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

type Props = {
  total: number;
  pageSize?: number;
};

/**
 * 목록 페이지 하단 페이지네이션 — 모든 list 도메인 공통.
 *
 * URL `?page=` 갱신으로 SSR 호환. prev/next 버튼 + 현재/총 페이지 표시.
 * total ≤ pageSize면 미노출 (페이지 1개라 의미 없음).
 *
 * 사용 예 (services / contracts / 향후 도메인 동일):
 *   <ListPagination total={total} pageSize={30} />
 */
export function ListPagination({ total, pageSize = 30 }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(
    1,
    Math.min(totalPages, Number(params.get("page") ?? 1)),
  );

  if (total <= pageSize) return null;

  function go(nextPage: number) {
    const next = new URLSearchParams(params.toString());
    if (nextPage <= 1) next.delete("page");
    else next.set("page", String(nextPage));
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <nav
      aria-label="페이지 이동"
      className="mt-6 flex items-center justify-center gap-3 text-sm"
    >
      <button
        type="button"
        onClick={() => go(page - 1)}
        disabled={page === 1}
        className="border border-line bg-cream px-3 py-1.5 text-ink transition-opacity hover:bg-washi-raised disabled:opacity-40"
      >
        ← 이전
      </button>
      <span className="font-mono text-xs text-muted">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        onClick={() => go(page + 1)}
        disabled={page === totalPages}
        className="border border-line bg-cream px-3 py-1.5 text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream disabled:opacity-40"
      >
        다음 →
      </button>
    </nav>
  );
}
