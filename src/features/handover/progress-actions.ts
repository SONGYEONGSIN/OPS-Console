"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/features/auth/queries";
import { logActivity } from "@/features/worklog/log";
import {
  handoverProgressCreateSchema,
  type HandoverProgressRow,
} from "./progress-schemas";

export type ActionResult<T = HandoverProgressRow> =
  | { ok: true; row: T }
  | { ok: false; error: string };

const AUTH_ERROR = "로그인이 필요합니다.";

/**
 * wizard step4 confirm — handover_progress insert (status='in_progress').
 * from_*은 현재 로그인 사용자, status는 in_progress 시작.
 */
export async function createHandoverProgress(
  input: unknown,
): Promise<ActionResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: AUTH_ERROR };

  const parsed = handoverProgressCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("handover_progress")
    .insert({
      service_id: parsed.data.service_id,
      from_email: me.email,
      from_name: me.displayName ?? me.email,
      to_email: parsed.data.to_email,
      to_name: parsed.data.to_name,
      notes: parsed.data.notes ?? null,
      status: "in_progress",
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };

  await logActivity({
    domain: "handover",
    action: "create_progress",
    target_type: "handover_progress",
    target_id: data.id,
    target_name: parsed.data.to_name,
    msg: `인계 시작 → ${parsed.data.to_name}`,
    metadata: { service_id: parsed.data.service_id, to_email: parsed.data.to_email },
  });

  revalidatePath("/dashboard/handover");
  return { ok: true, row: data as HandoverProgressRow };
}

/**
 * 인수자 confirm — status='completed' + confirmed_at + handover_records.status='published'.
 * 인수자(to_email) 본인만 호출 가능 (RLS는 admin/member 전체 허용이라 app-level 가드).
 */
export async function confirmHandoverProgress(
  progressId: string,
): Promise<ActionResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: AUTH_ERROR };

  const supabase = await createClient();
  // 1) 본인이 to_email인지 검증
  const { data: prog, error: fetchErr } = await supabase
    .from("handover_progress")
    .select("id, to_email, service_id, status")
    .eq("id", progressId)
    .maybeSingle();
  if (fetchErr || !prog) {
    return { ok: false, error: fetchErr?.message ?? "progress not found" };
  }
  if (prog.to_email !== me.email) {
    return { ok: false, error: "본인이 인수자인 인계만 확인할 수 있습니다." };
  }
  if (prog.status !== "in_progress") {
    return { ok: false, error: "진행 중인 인계만 확인할 수 있습니다." };
  }

  // 2) handover_progress 갱신
  const { data, error } = await supabase
    .from("handover_progress")
    .update({
      status: "completed",
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", progressId)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };

  // 3) handover_records.status='published'
  const { error: recErr } = await supabase
    .from("handover_records")
    .update({ status: "published" })
    .eq("service_id", prog.service_id);
  if (recErr) {
    console.error("[confirmHandoverProgress] record status update:", recErr);
    // progress 갱신은 성공했으므로 ok로 반환 (record status는 후속 보정 가능)
  }

  await logActivity({
    domain: "handover",
    action: "confirm",
    target_type: "handover_progress",
    target_id: progressId,
    msg: "인계 확인 완료",
  });

  revalidatePath("/dashboard/handover");
  return { ok: true, row: data as HandoverProgressRow };
}

/** 진행 취소 — admin 또는 from_email 본인만 (app-level 가드) */
export async function cancelHandoverProgress(
  progressId: string,
): Promise<ActionResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: AUTH_ERROR };

  const supabase = await createClient();
  const { data: prog, error: fetchErr } = await supabase
    .from("handover_progress")
    .select("id, from_email, status")
    .eq("id", progressId)
    .maybeSingle();
  if (fetchErr || !prog) {
    return { ok: false, error: fetchErr?.message ?? "progress not found" };
  }
  const isOwner = prog.from_email === me.email;
  const isAdmin = me.permission === "admin";
  if (!isOwner && !isAdmin) {
    return { ok: false, error: "본인 또는 admin만 취소할 수 있습니다." };
  }
  if (prog.status !== "in_progress") {
    return { ok: false, error: "진행 중인 인계만 취소할 수 있습니다." };
  }

  const { data, error } = await supabase
    .from("handover_progress")
    .update({ status: "cancelled" })
    .eq("id", progressId)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };

  await logActivity({
    domain: "handover",
    action: "cancel",
    target_type: "handover_progress",
    target_id: progressId,
    level: "WARN",
    msg: "인계 취소",
  });

  revalidatePath("/dashboard/handover");
  return { ok: true, row: data as HandoverProgressRow };
}
