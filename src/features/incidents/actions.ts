"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  incidentCreateSchema,
  incidentUpdateSchema,
  type IncidentDepartment,
  type IncidentRow,
} from "./schemas";

export type IncidentActionResult =
  | { ok: true; row: IncidentRow }
  | { ok: false; error: string };

const AUTH_ERROR = "로그인이 필요합니다.";
const PATH = "/dashboard/incidents";

/**
 * PR-6: 담당부서별 고정 보고자 매핑.
 * 운영부-운영1팀 담당자가 작성 → 허승철에게 보고
 * 운영부-운영2팀 담당자가 작성 → 송영신에게 보고
 */
const REPORTER_BY_DEPARTMENT: Record<
  IncidentDepartment,
  { email: string; name: string }
> = {
  "운영부-운영1팀": { email: "alcure23@jinhakapply.com", name: "허승철" },
  "운영부-운영2팀": { email: "ys1114@jinhakapply.com", name: "송영신" },
};

export async function createIncident(
  input: unknown,
): Promise<IncidentActionResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: AUTH_ERROR };

  const parsed = incidentCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const reporter = REPORTER_BY_DEPARTMENT[parsed.data.department];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incidents")
    .insert({
      ...parsed.data,
      assignee_email: me.email,
      assignee_name: me.displayName ?? me.email,
      reporter_email: reporter.email,
      reporter_name: reporter.name,
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath(PATH);
  return { ok: true, row: data as IncidentRow };
}

export async function updateIncident(
  id: string,
  input: unknown,
): Promise<IncidentActionResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: AUTH_ERROR };

  const parsed = incidentUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const patch: Record<string, unknown> = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };

  // department 변경 시 reporter_* 자동 재매핑
  if (parsed.data.department) {
    const reporter = REPORTER_BY_DEPARTMENT[parsed.data.department];
    patch.reporter_email = reporter.email;
    patch.reporter_name = reporter.name;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incidents")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath(PATH);
  return { ok: true, row: data as IncidentRow };
}
