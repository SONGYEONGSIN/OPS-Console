"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  cohortCreateSchema,
  cohortUpdateSchema,
  type CohortRow,
} from "./schemas";

export type CohortActionResult =
  | { ok: true; row: CohortRow }
  | { ok: false; error: string };

const PERMISSION_ERROR_ADMIN = "권한 없음 — 회차 관리는 admin만 가능합니다.";
const NOT_FOUND_ERROR = "회차를 찾을 수 없습니다.";

const COHORT_PATH = "/dashboard/onboarding";

export async function createCohort(input: unknown): Promise<CohortActionResult> {
  const parsed = cohortCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const me = await getCurrentOperator();
  if (me?.permission !== "admin") {
    return { ok: false, error: PERMISSION_ERROR_ADMIN };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("onboarding_cohorts")
    .insert(parsed.data)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath(COHORT_PATH);
  return { ok: true, row: data as CohortRow };
}

export async function updateCohort(
  id: string,
  input: unknown,
): Promise<CohortActionResult> {
  const parsed = cohortUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const me = await getCurrentOperator();
  if (me?.permission !== "admin") {
    return { ok: false, error: PERMISSION_ERROR_ADMIN };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("onboarding_cohorts")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: NOT_FOUND_ERROR };
  revalidatePath(COHORT_PATH);
  return { ok: true, row: data as CohortRow };
}

export async function deleteCohort(id: string): Promise<CohortActionResult> {
  const me = await getCurrentOperator();
  if (me?.permission !== "admin") {
    return { ok: false, error: PERMISSION_ERROR_ADMIN };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("onboarding_cohorts")
    .delete()
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: NOT_FOUND_ERROR };
  revalidatePath(COHORT_PATH);
  return { ok: true, row: data as CohortRow };
}
