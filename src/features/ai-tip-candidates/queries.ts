import "server-only";
import { createClient } from "@/lib/supabase/server";
import { aiTipCandidateRowSchema, type AiTipCandidateRow } from "./schemas";

/**
 * 후보 전건 — 최신 수집순. 파싱 실패 행은 건너뛰고 로그만 남긴다.
 * status로 거르지 않는 이유: 숨긴 건을 되돌리려면 화면에 보여야 하고,
 * 상태별 건수도 전건이 있어야 센다. 주 1회 수집이라 규모는 늘지 않는다.
 */
export async function listCandidates(): Promise<AiTipCandidateRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_tip_candidates")
    .select("*")
    .order("collected_at", { ascending: false });
  if (error) {
    console.error("[listCandidates] supabase error:", error);
    return [];
  }
  const out: AiTipCandidateRow[] = [];
  for (const row of data ?? []) {
    const parsed = aiTipCandidateRowSchema.safeParse(row);
    if (parsed.success) out.push(parsed.data);
    else console.error("[listCandidates] zod parse fail:", parsed.error);
  }
  return out;
}
