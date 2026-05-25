"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportCreateSchema, type ReportCreateInput } from "./schemas";
import { getReportKpis } from "./queries";

export type ReportActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * 리포트 생성 — 현재 시점의 KPI 스냅샷을 fetch해서 DB에 영속화.
 * admin·member 권한만. viewer 차단.
 */
export async function createReport(
  input: ReportCreateInput,
): Promise<ReportActionResult> {
  const parsed = reportCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const me = await getCurrentOperator();
  if (!me || me.permission === "viewer" || me.permission === null) {
    return { ok: false, error: "권한 없음" };
  }

  const snap = await getReportKpis(parsed.data.period);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("reports")
    .insert({
      title: parsed.data.title,
      period: parsed.data.period,
      period_start: snap.periodRange.startYmd,
      period_end: snap.periodRange.endYmd,
      kpis: snap.kpis,
      status: "completed",
      created_by: me.email,
    })
    .select()
    .single();

  if (error || !data)
    return { ok: false, error: error?.message ?? "insert fail" };
  revalidatePath("/dashboard/reports");
  return { ok: true, id: (data as { id: string }).id };
}

/**
 * 리포트 삭제 — admin만.
 */
export async function deleteReport(id: string): Promise<ReportActionResult> {
  const me = await getCurrentOperator();
  if (me?.permission !== "admin") return { ok: false, error: "권한 없음" };
  const admin = createAdminClient();
  const { error } = await admin.from("reports").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/reports");
  return { ok: true, id };
}

/**
 * 공유 토큰 생성·해제 — admin만. 토큰이 null이면 생성, 있으면 해제.
 */
export async function toggleReportShare(
  id: string,
): Promise<ReportActionResult & { token?: string | null }> {
  const me = await getCurrentOperator();
  if (me?.permission !== "admin") return { ok: false, error: "권한 없음" };
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("reports")
    .select("share_token")
    .eq("id", id)
    .maybeSingle();
  const nextToken =
    (existing as { share_token: string | null } | null)?.share_token
      ? null
      : crypto.randomUUID();
  const { error } = await admin
    .from("reports")
    .update({ share_token: nextToken })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/reports/${id}`);
  return { ok: true, id, token: nextToken };
}
