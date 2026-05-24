import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  assignmentRowSchema,
  cycleRowSchema,
  goalRowSchema,
  planRowSchema,
  reviewRowSchema,
  type AssignmentRow,
  type CycleRow,
  type GoalRow,
  type PlanRow,
  type ReviewRow,
} from "./schemas";

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

/** assignment 1건 상세 — goals + plans + reviews. RLS가 본인 관련만 노출. */
export type AssignmentDetail = {
  assignment: AssignmentRow;
  cycle: { name: string; status: "open" | "closed" };
  goals: GoalRow[];
  plans: PlanRow[];
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

  const [goalsRes, reviewsRes] = await Promise.all([
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
    reviews,
  };
}
