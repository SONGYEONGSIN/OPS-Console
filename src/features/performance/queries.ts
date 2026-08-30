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
import { aggregateSavedHours } from "./aggregators/saved-hours";
import { aggregateEntertest } from "./aggregators/entertest";
import { aggregateDevControl } from "./aggregators/dev-control";
import { aggregateAnnouncement } from "./aggregators/announcement";
import {
  effectiveAchievement,
  type AchievementSource,
} from "./effective-achievement";
import { academicYearRangeKST } from "@/features/closing/academic-year";

/**
 * 정량 집계 기간.
 *
 * 사이클에 기간이 있으면 그것을 쓴다. 없으면 **학년도**(3/1~익년 2월말)로 떨어진다 —
 * 연도(1/1~12/31)를 쓰던 때는 우리 성과 기간과 어긋나 3월 이전 실적이 섞였다.
 */
function periodOfCycle(cycle: {
  period_start?: string | null;
  period_end?: string | null;
}): Period {
  if (cycle.period_start && cycle.period_end) {
    return { startYmd: cycle.period_start, endYmd: cycle.period_end };
  }
  // academicYearRangeKST 는 {start:{date,time}} 모양이다 — 날짜만 쓴다.
  const r = academicYearRangeKST(new Date());
  return { startYmd: r.start.date, endYmd: r.end.date };
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
  if (sourceKey === "ai-work-hours") {
    const { data } = await supabase
      .from("ai_work")
      .select("author_email, saved_hours, created_at")
      .eq("author_email", evaluateeEmail);
    return aggregateSavedHours(data ?? [], evaluateeEmail, period);
  }
  if (sourceKey === "announcement-services") {
    // 총괄장이 이름으로 배정하므로 이 갈래만 이름으로 맞춘다(마감과 같은 사정).
    const operatorName =
      OPERATORS.find((o) => o.email === evaluateeEmail)?.name ?? null;
    const { data } = await supabase
      .from("announcement_services")
      .select("operator_name, last_announce_at")
      .eq("operator_name", operatorName ?? "__none__");
    return aggregateAnnouncement(data ?? [], operatorName, period);
  }
  if (sourceKey === "dev-control-changes") {
    // 이력이 services.operator_name 스냅샷을 들고 있어 이 갈래도 이름으로 맞춘다.
    const operatorName =
      OPERATORS.find((o) => o.email === evaluateeEmail)?.name ?? null;
    const { data } = await supabase
      .from("dev_control_setting_changes")
      .select("operator_name, prev_code_hash, observed_at")
      .eq("operator_name", operatorName ?? "__none__");
    return aggregateDevControl(data ?? [], operatorName, period);
  }
  if (sourceKey === "entertest-runs") {
    const { data } = await supabase
      .from("entertest_test_runs")
      .select("requested_by, status, requested_at")
      .eq("requested_by", evaluateeEmail);
    return aggregateEntertest(data ?? [], evaluateeEmail, period);
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
  // 미리보기는 사이클을 모른다 — 학년도 기준으로 보여준다.
  return computeQuant(supabase, sourceKey, email, periodOfCycle({}));
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
    .select("*, performance_cycles(name, status, period_start, period_end)")
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
export type MetricWithQuant = MetricRow & {
  quant: MetricValue | null;
  /** 화면·채점이 쓸 달성률 하나. 목표가 있으면 계산값, 없으면 손입력. */
  effective: { value: number; source: AchievementSource };
};

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
    .select("*, performance_cycles(name, status, period_start, period_end)")
    .eq("id", id)
    .maybeSingle();
  if (aErr || !aRow) return null;
  const assignment = assignmentRowSchema.safeParse(aRow);
  if (!assignment.success) return null;
  const cycleJoin = (aRow as Record<string, unknown>).performance_cycles as
    | {
        name: string;
        status: "open" | "closed";
        // 기간이 없는 옛 사이클이 있다 — 그때는 학년도로 떨어진다.
        period_start: string | null;
        period_end: string | null;
      }
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
  const period = periodOfCycle(cycleJoin);
  const evaluateeEmail = assignment.data.evaluatee_email;
  const metrics: MetricWithQuant[] = [];
  for (const m of metricsRes.data ?? []) {
    const p = metricRowSchema.safeParse(m);
    if (!p.success) continue;
    const quant = p.data.source_key
      ? await computeQuant(supabase, p.data.source_key, evaluateeEmail, period)
      : null;
    // 목표가 있으면 실적/목표로 계산한다 — 손으로 넣던 값을 덮는다.
    const effective = effectiveAchievement({
      target: p.data.target_value,
      actual: quant?.value ?? null,
      manual: p.data.achievement,
      lowerIsBetter: p.data.lower_is_better,
    });
    metrics.push({ ...p.data, quant, effective });
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
