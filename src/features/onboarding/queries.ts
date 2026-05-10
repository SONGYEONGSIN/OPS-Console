import "server-only";
import { createClient } from "@/lib/supabase/server";
import { cohortRowSchema, type CohortRow } from "./schemas";

/**
 * 회차 fetch (RSC).
 * RLS: admin OR trainee/mentor. UI는 RLS 결과를 그대로 표시.
 * 정렬: start_date desc (최근 회차 위).
 */
export async function listCohorts(): Promise<CohortRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("onboarding_cohorts")
    .select("*")
    .order("start_date", { ascending: false });

  if (error) {
    console.error("[listCohorts] supabase error:", error);
    return [];
  }

  const parsed: CohortRow[] = [];
  for (const row of data ?? []) {
    const r = cohortRowSchema.safeParse(row);
    if (r.success) parsed.push(r.data);
    else
      console.error(
        "[listCohorts] zod parse fail:",
        r.error.issues,
        "row:",
        row,
      );
  }
  return parsed;
}

export async function getCohortById(id: string): Promise<CohortRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("onboarding_cohorts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const r = cohortRowSchema.safeParse(data);
  return r.success ? r.data : null;
}
