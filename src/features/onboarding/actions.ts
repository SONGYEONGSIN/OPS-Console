"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

/**
 * trainee_email로 Supabase Auth invite 메일 발송 + cohort.invited_at 갱신.
 * admin only. 이미 가입된 이메일이어도 invited_at은 갱신 (재초대 의미).
 *
 * 사전 조건 (Supabase Studio):
 * - Authentication > URL Configuration > Redirect URLs에
 *   `${SITE_URL}/auth/onboarding-callback` 등록
 * - Authentication > Email Templates > Invite user 한국어 템플릿
 * - Authentication > SMTP Settings (커스텀 SMTP 권장 — Supabase 기본은 발송 한도)
 */
export async function inviteCohortTrainee(
  cohortId: string,
): Promise<CohortActionResult> {
  const me = await getCurrentOperator();
  if (me?.permission !== "admin") {
    return { ok: false, error: PERMISSION_ERROR_ADMIN };
  }

  const admin = createAdminClient();

  // cohort lookup (RLS bypass — admin client)
  const { data: target, error: lookupError } = await admin
    .from("onboarding_cohorts")
    .select("*")
    .eq("id", cohortId)
    .maybeSingle();
  if (lookupError) return { ok: false, error: lookupError.message };
  if (!target) return { ok: false, error: NOT_FOUND_ERROR };

  // SITE_URL: NEXT_PUBLIC_SITE_URL → 우선, 없으면 NEXT_PUBLIC_VERCEL_URL → fallback
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : "http://localhost:3000");
  const redirectTo = `${siteUrl}/auth/onboarding-callback`;

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    target.trainee_email,
    { redirectTo },
  );
  if (inviteError) {
    // 이미 가입된 이메일은 invited_at만 갱신 (재초대 의미는 유지)
    if (!/already.*registered|exists/i.test(inviteError.message)) {
      return { ok: false, error: inviteError.message };
    }
  }

  const { data: updated, error: updateError } = await admin
    .from("onboarding_cohorts")
    .update({ invited_at: new Date().toISOString() })
    .eq("id", cohortId)
    .select()
    .single();
  if (updateError) return { ok: false, error: updateError.message };

  revalidatePath(COHORT_PATH);
  return { ok: true, row: updated as CohortRow };
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
