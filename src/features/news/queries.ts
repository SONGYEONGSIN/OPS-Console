import "server-only";
import { createClient } from "@/lib/supabase/server";
import { newsRowSchema, type NewsRow } from "./schemas";

/**
 * 운영부 뉴스 목록 fetch (RSC).
 * RLS: authenticated → 모든 row read 허용 (운영부 공개 정책).
 * 정렬: published_at desc (최신 기사 우선) — null published_at은 후순위.
 * 최대 100건.
 */
export async function listNews(): Promise<NewsRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news")
    .select("*")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) {
    console.error("[listNews] supabase error:", error);
    return [];
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
  return parsed;
}
