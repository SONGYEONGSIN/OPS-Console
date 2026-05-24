"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  goalCreateSchema,
  planUpsertSchema,
  reviewCreateSchema,
  type Step,
} from "./schemas";

const REVALIDATE = "/dashboard/performance";

/** assignment의 current_step을 expected → next로 optimistic update.
 *  expected와 일치하지 않으면 race로 간주, 실패. */
async function advanceStep(
  assignmentId: string,
  expected: Step,
  next: Step,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("performance_assignments")
    .update({ current_step: next })
    .eq("id", assignmentId)
    .eq("current_step", expected);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** step=1(목표설정) — 평가자가 goal 등록 + step 2로 advance.
 *  같은 assignment에 N개 goal 등록 가능, 최초 등록 시점에만 step 전진. */
export async function createGoal(
  input: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = goalCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("performance_goals")
    .insert(parsed.data);
  if (error) return { ok: false, error: error.message };

  // 첫 goal이면 step 1→2 advance. 이미 step≥2면 advance skip.
  const { data: aRow } = await supabase
    .from("performance_assignments")
    .select("current_step")
    .eq("id", parsed.data.assignment_id)
    .maybeSingle();
  if (aRow?.current_step === 1) {
    await advanceStep(parsed.data.assignment_id, 1, 2);
  }

  revalidatePath(REVALIDATE);
  return { ok: true };
}

/** step=2(실행계획) — 팀원이 goal별 plan 작성/수정. 모든 goal에 plan 작성 시 step 3 advance.
 *  단순화: 호출자가 plan upsert 후 명시적으로 advance 액션 호출. */
export async function upsertPlan(
  input: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = planUpsertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("performance_plans")
    .upsert(parsed.data, { onConflict: "goal_id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath(REVALIDATE);
  return { ok: true };
}

/** step=3..7 검토/평가 row 등록. step별 next로 advance. */
export async function submitReview(
  input: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = reviewCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { step } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("performance_reviews")
    .insert(parsed.data);
  if (error) return { ok: false, error: error.message };

  // step→next advance (step=7 종합평가 후 8 완료)
  const next = (step + 1) as Step;
  await advanceStep(parsed.data.assignment_id, step as Step, next);

  revalidatePath(REVALIDATE);
  return { ok: true };
}

/** step=2(실행계획) 완료 후 step 3로 명시적 전진 (팀원이 '검토 요청' 버튼). */
export async function submitPlan(
  assignmentId: string,
): Promise<{ ok: boolean; error?: string }> {
  return advanceStep(assignmentId, 2, 3);
}
