import "server-only";
import { createClient } from "@/lib/supabase/server";
import { aiWorkRowSchema, type AiWorkRow } from "./schemas";

export type AiWorkFilter = {
  authorEmail?: string;
  aiTool?: string;
  category?: string;
};

/**
 * AI 활용 작업 목록 fetch (RSC).
 * RLS: authenticated → 모든 row read 허용 (운영부 공개 정책).
 * 정렬: work_start_date desc → created_at desc.
 */
export async function listAiWorks(filter?: AiWorkFilter): Promise<AiWorkRow[]> {
  const supabase = await createClient();
  let query = supabase.from("ai_work").select("*");
  if (filter?.authorEmail) query = query.eq("author_email", filter.authorEmail);
  if (filter?.aiTool) query = query.eq("ai_tool", filter.aiTool);
  if (filter?.category) query = query.eq("category", filter.category);
  const { data, error } = await query
    .order("work_start_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listAiWorks] supabase error:", error);
    return [];
  }

  const parsed: AiWorkRow[] = [];
  for (const row of data ?? []) {
    const r = aiWorkRowSchema.safeParse(row);
    if (r.success) parsed.push(r.data);
    else
      console.error(
        "[listAiWorks] zod parse fail:",
        r.error.issues,
        "row:",
        row,
      );
  }
  return parsed;
}
