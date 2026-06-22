import "server-only";
import { createClient } from "@/lib/supabase/server";
import { newsRowSchema, type NewsRow } from "./schemas";

/**
 * 운영부 뉴스 목록 fetch (RSC) — 서버 페이지네이션.
 * RLS: authenticated → 모든 row read 허용 (운영부 공개 정책).
 * 정렬: published_at desc (최신 기사 우선) — null published_at은 후순위.
 * page(1-base)/pageSize로 range 조회, 전체 건수(total) 함께 반환.
 */
export async function listNews(
  opts: { page?: number; pageSize?: number } = {},
): Promise<{ rows: NewsRow[]; total: number }> {
  const page = opts.page && opts.page > 0 ? opts.page : 1;
  const pageSize = opts.pageSize && opts.pageSize > 0 ? opts.pageSize : 30;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("news")
    .select("*", { count: "exact" })
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (error) {
    console.error("[listNews] supabase error:", error);
    return { rows: [], total: 0 };
  }

  const parsed: NewsRow[] = [];
  for (const row of data ?? []) {
    const r = newsRowSchema.safeParse(row);
    if (r.success) parsed.push(r.data);
    else
      console.error(
        "[listNews] zod parse fail:",
        r.error.issues,
        "row:",
        row,
      );
  }
  return { rows: parsed, total: count ?? 0 };
}
