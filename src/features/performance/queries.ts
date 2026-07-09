import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  assignmentRowSchema,
  cycleRowSchema,
  goalRowSchema,
  planRowSchema,
  reviewRowSchema,
  metricRowSchema,
  rubricScoreRowSchema,
  type AssignmentRow,
  type CycleRow,
  type GoalRow,
  type PlanRow,
  type ReviewRow,
  type MetricRow,
  type RubricScoreRow,
} from "./schemas";
import { OPERATORS } from "@/features/auth/operators";
import type { MetricValue, Period } from "./aggregators/types";
import { aggregateClosing } from "./aggregators/closing";
import { aggregateIncidents } from "./aggregators/incidents";
import { aggregateAiWork } from "./aggregators/ai-work";

/** 정량 집계 기간 — MVP는 현재 연도(1/1~12/31, KST). 사이클 날짜 도입 시 대체. */
function currentYearPeriod(): Period {
  const y = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).format(new Date());
  return { startYmd: `${y}-01-01`, endYmd: `${y}-12-31` };
}

/** source_key별 aggregator 실행 — 미매칭 소스는 null. */
async function computeQuant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sourceKey: string,
  evaluateeEmail: string,
  period: Period,
): Promise<MetricValue | null> {
  if (sourceKey === "closing-completed") {
    const operatorName =
      OPERATORS.find((o) => o.email === evaluateeEmail)?.name ?? null;
    const { data } = await supabase
      .from("closing_services")
      .select("operator_name, write_end_at")
      .eq("operator_name", operatorName ?? "__none__");
    return aggregateClosing(data ?? [], operatorName, period);
  }
  if (sourceKey === "incident-resolve-rate") {
    const { data } = await supabase
      .from("incidents")
      .select("assignee_email, status, created_at")
      .eq("assignee_email", evaluateeEmail);
    return aggregateIncidents(data ?? [], evaluateeEmail, period);
  }
  if (sourceKey === "ai-work-count") {
    const { data } = await supabase
      .from("ai_work")
      .select("author_email, created_at")
      .eq("author_email", evaluateeEmail);
    return aggregateAiWork(data ?? [], evaluateeEmail, period);
  }
  return null;
}

/** 지표 추가 폼용 — assignment의 팀원 기준 정량 소스 현재값 미리보기. */
export async function getQuantPreview(
  assignmentId: string,
  sourceKey: string,
): Promise<MetricValue | null> {
  const supabase = await createClient();
  const { data: aRow } = await supabase
    .from("performance_assignments")
    .select("evaluatee_email")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!aRow) return null;
  const email = (aRow as { evaluatee_email: string }).evaluatee_email;
  return computeQuant(supabase, sourceKey, email, currentYearPeriod());
}

/** 본인이 evaluator OR evaluatee인 assignment + cycle 정보 조인.
 *  admin은 전체 조회 — RLS가 자동 분기.
 */
export type AssignmentWithCycle = AssignmentRow & {
  cycle_name: string;
  cycle_status: "open" | "closed";
};

export async function listAssignmentsForUser(): Promise<AssignmentWithCycle[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("performance_assignments")
    .select("*, performance_cycles(name, status)")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[listAssignmentsForUser]", error);
    return [];
  }
  const rows: AssignmentWithCycle[] = [];
  for (const r of data ?? []) {
    const parsed = assignmentRowSchema.safeParse(r);
    if (!parsed.success) continue;
    const cycleJoin = (r as Record<string, unknown>).performance_cycles as
      | { name: string; status: "open" | "closed" }
      | null;
    if (!cycleJoin) continue;
    rows.push({
      ...parsed.data,
      cycle_name: cycleJoin.name,
      cycle_status: cycleJoin.status,
    });
  }
  return rows;
}

/** admin 전용 — 전체 cycle 조회 (사이클 관리 페이지 보조). */
export async function listCycles(): Promise<CycleRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("performance_cycles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[listCycles]", error);
    return [];
  }
  const out: CycleRow[] = [];
  for (const r of data ?? []) {
    const p = cycleRowSchema.safeParse(r);
    if (p.success) out.push(p.data);
  }
  return out;
}

/** 성과지표 + 정량 자동집계 값(있으면). */
export type MetricWithQuant = MetricRow & { quant: MetricValue | null };

/** assignment 1건 상세 — goals + plans + metrics(정량) + rubric + reviews(legacy). */
export type AssignmentDetail = {
  assignment: AssignmentRow;
  cycle: { name: string; status: "open" | "closed" };
  goals: GoalRow[];
  plans: PlanRow[];
  metrics: MetricWithQuant[];
  rubric: RubricScoreRow[];
  reviews: ReviewRow[];
};

export async function getAssignmentDetail(
  id: string,
): Promise<AssignmentDetail | null> {
  const supabase = await createClient();
  const { data: aRow, error: aErr } = await supabase
    .from("performance_assignments")
    .select("*, performance_cycles(name, status)")
    .eq("id", id)
    .maybeSingle();
  if (aErr || !aRow) return null;
  const assignment = assignmentRowSchema.safeParse(aRow);
  if (!assignment.success) return null;
  const cycleJoin = (aRow as Record<string, unknown>).performance_cycles as
    | { name: string; status: "open" | "closed" }
    | null;
  if (!cycleJoin) return null;

  const [goalsRes, reviewsRes, metricsRes, rubricRes] = await Promise.all([
    supabase
      .from("performance_goals")
      .select("*")
      .eq("assignment_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("performance_reviews")
      .select("*")
      .eq("assignment_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("performance_metrics")
      .select("*")
      .eq("assignment_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("performance_rubric_scores")
      .select("*")
      .eq("assignment_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const goals: GoalRow[] = [];
  for (const g of goalsRes.data ?? []) {
    const p = goalRowSchema.safeParse(g);
    if (p.success) goals.push(p.data);
  }
  const reviews: ReviewRow[] = [];
  for (const v of reviewsRes.data ?? []) {
    const p = reviewRowSchema.safeParse(v);
    if (p.success) reviews.push(p.data);
  }

  // 성과지표 + 정량 자동집계 (source_key 있는 지표만 aggregator 실행)
  const period = currentYearPeriod();
  const evaluateeEmail = assignment.data.evaluatee_email;
  const metrics: MetricWithQuant[] = [];
  for (const m of metricsRes.data ?? []) {
    const p = metricRowSchema.safeParse(m);
    if (!p.success) continue;
    const quant = p.data.source_key
      ? await computeQuant(supabase, p.data.source_key, evaluateeEmail, period)
      : null;
    metrics.push({ ...p.data, quant });
  }
  const rubric: RubricScoreRow[] = [];
  for (const r of rubricRes.data ?? []) {
    const p = rubricScoreRowSchema.safeParse(r);
    if (p.success) rubric.push(p.data);
  }

  // plans는 goal_id IN (...) — goals 없으면 skip
  let plans: PlanRow[] = [];
  if (goals.length > 0) {
    const { data: planRows } = await supabase
      .from("performance_plans")
      .select("*")
      .in("goal_id", goals.map((g) => g.id));
    plans = [];
    for (const p of planRows ?? []) {
      const parsed = planRowSchema.safeParse(p);
      if (parsed.success) plans.push(parsed.data);
    }
  }

  return {
    assignment: assignment.data,
    cycle: cycleJoin,
    goals,
    plans,
    metrics,
    rubric,
    reviews,
  };
}
