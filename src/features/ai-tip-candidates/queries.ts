import "server-only";
import { createClient } from "@/lib/supabase/server";
import { aiTipCandidateRowSchema, type AiTipCandidateRow } from "./schemas";

/** 검토 대기 후보 — 최신 수집순. 파싱 실패 행은 건너뛰고 로그만 남긴다. */
export async function listPendingCandidates(): Promise<AiTipCandidateRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_tip_candidates")
    .select("*")
    .eq("status", "pending")
    .order("collected_at", { ascending: false });
  if (error) {
    console.error("[listPendingCandidates] supabase error:", error);
    return [];
  }
  const out: AiTipCandidateRow[] = [];
  for (const row of data ?? []) {
    const parsed = aiTipCandidateRowSchema.safeParse(row);
    if (parsed.success) out.push(parsed.data);
    else console.error("[listPendingCandidates] zod parse fail:", parsed.error);
  }
  return out;
}
