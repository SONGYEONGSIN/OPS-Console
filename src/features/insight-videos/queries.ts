import "server-only";
import { createClient } from "@/lib/supabase/server";
import { insightVideoRowSchema, type InsightVideoRow } from "./schemas";

/**
 * 인사이트 영상 목록 fetch (RSC).
 * RLS: authenticated → 모든 row read 허용 (운영부 공개 정책).
 * 정렬: published_at desc. 최대 30건.
 */
export async function listInsightVideos(): Promise<InsightVideoRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("insight_videos")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("[listInsightVideos] supabase error:", error);
    return [];
  }

  const parsed: InsightVideoRow[] = [];
  for (const row of data ?? []) {
    const r = insightVideoRowSchema.safeParse(row);
    if (r.success) parsed.push(r.data);
    else
      console.error(
        "[listInsightVideos] zod parse fail:",
        r.error.issues,
        "row:",
        row,
      );
  }
  return parsed;
}
