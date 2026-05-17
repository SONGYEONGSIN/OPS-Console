import "server-only";
import { createClient } from "@/lib/supabase/server";
import { aiTipRowSchema, type AiTipRow } from "./schemas";

export type AiTipFilter = {
  authorEmail?: string;
  aiTool?: string;
  category?: string;
};

/**
 * AI 팁 목록 fetch (RSC).
 * RLS: authenticated → 모든 row read (운영부 공개 정책).
 * 정렬: created_at desc.
 */
export async function listAiTips(filter?: AiTipFilter): Promise<AiTipRow[]> {
  const supabase = await createClient();
  let query = supabase.from("ai_tips").select("*");
  if (filter?.authorEmail) query = query.eq("author_email", filter.authorEmail);
  if (filter?.aiTool) query = query.eq("ai_tool", filter.aiTool);
  if (filter?.category) query = query.eq("category", filter.category);
  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("[listAiTips] supabase error:", error);
    return [];
  }

  const parsed: AiTipRow[] = [];
  for (const row of data ?? []) {
    const r = aiTipRowSchema.safeParse(row);
    if (r.success) parsed.push(r.data);
    else
      console.error(
        "[listAiTips] zod parse fail:",
        r.error.issues,
        "row:",
        row,
      );
  }
  return parsed;
}
