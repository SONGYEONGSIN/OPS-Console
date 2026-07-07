"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  goalCreateSchema,
  planUpsertSchema,
  reviewCreateSchema,
  metricCreateSchema,
  rubricUpsertSchema,
  RUBRIC_CRITERIA,
  type Step,
} from "./schemas";
import { isValidMetricWeights } from "./scoring";

const REVALIDATE = "/dashboard/outcomes";

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

/** 새 사이클 + 팀원 assignment 생성 (관리자=본인, step 1 시작). */
export async function createCycleWithAssignment(input: {
  cycleName: string;
  evaluateeEmail: string;
  evaluatorEmail: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const cycleName = input.cycleName?.trim();
  if (!cycleName) return { ok: false, error: "사이클명을 입력하세요." };
  if (!input.evaluateeEmail) return { ok: false, error: "팀원을 선택하세요." };
  const supabase = await createClient();
  const { data: cycle, error: cErr } = await supabase
    .from("performance_cycles")
    .insert({ name: cycleName, status: "open" })
    .select("id")
    .single();
  if (cErr || !cycle) {
    return { ok: false, error: cErr?.message ?? "사이클 생성 실패" };
  }
  const { data: asg, error: aErr } = await supabase
    .from("performance_assignments")
    .insert({
      cycle_id: cycle.id,
      evaluator_email: input.evaluatorEmail,
      evaluatee_email: input.evaluateeEmail,
      current_step: 1,
    })
    .select("id")
    .single();
  if (aErr || !asg) {
    return { ok: false, error: aErr?.message ?? "assignment 생성 실패" };
  }
  revalidatePath(REVALIDATE);
  return { ok: true, id: asg.id };
}

/* ─── 신규: 성과지표(step 2) + 관리자 루브릭(step 3) + 발행(step 4) ─── */

/** step=2 — 팀원이 성과지표 추가 (assignment당 N개). */
export async function createMetric(
  input: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = metricCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("performance_metrics")
    .insert(parsed.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath(REVALIDATE);
  return { ok: true };
}

/** step=2 완료 — 성과지표 가중치 합=80 검증 후 step 3(관리자 평가)로 전진. */
export async function submitMetrics(
  assignmentId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("performance_metrics")
    .select("weight")
    .eq("assignment_id", assignmentId);
  if (error) return { ok: false, error: error.message };
  const weights = (data ?? []).map((m) => (m as { weight: number }).weight);
  if (!isValidMetricWeights(weights)) {
    return { ok: false, error: "성과지표 가중치 합이 80이어야 합니다." };
  }
  return advanceStep(assignmentId, 2, 3);
}

/** step=3 — 관리자가 루브릭 항목 채점(upsert, criterion 유니크). */
export async function upsertRubric(
  input: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = rubricUpsertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("performance_rubric_scores")
    .upsert(parsed.data, { onConflict: "assignment_id,criterion" });
  if (error) return { ok: false, error: error.message };
  revalidatePath(REVALIDATE);
  return { ok: true };
}

/** step=3 완료 — 루브릭 3개 항목 전부 채점 확인 후 step 4(발행)로 전진. */
export async function publishReport(
  assignmentId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("performance_rubric_scores")
    .select("criterion")
    .eq("assignment_id", assignmentId);
  if (error) return { ok: false, error: error.message };
  const scored = new Set(
    (data ?? []).map((r) => (r as { criterion: string }).criterion),
  );
  if (!RUBRIC_CRITERIA.every((c) => scored.has(c))) {
    return {
      ok: false,
      error: "관리자 루브릭 3개 항목을 모두 채점해야 발행할 수 있습니다.",
    };
  }
  return advanceStep(assignmentId, 3, 4);
}
