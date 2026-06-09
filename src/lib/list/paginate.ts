export const DEFAULT_PAGE_SIZE = 30;

/**
 * 목록 클라이언트 페이지네이션 — 전체 rows를 메모리에서 page 단위로 slice.
 * 전체 fetch 후 자르는 메뉴(ListPagination + ?page) 공용. 서버 .range가 아닌 경우.
 *
 * - pageParam이 비거나 잘못된 값이면 1페이지.
 * - 범위를 벗어난 page는 마지막 페이지로 clamp.
 */
export function paginateRows<T>(
  rows: readonly T[],
  pageParam: string | undefined,
  pageSize: number = DEFAULT_PAGE_SIZE,
): { rows: T[]; total: number; page: number; totalPages: number } {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(1, Math.min(totalPages, Number(pageParam ?? 1) || 1));
  const start = (page - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    total,
    page,
    totalPages,
  };
}
