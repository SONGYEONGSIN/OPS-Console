"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  updateDevControlFlagSchema,
  devControlFlagSchema,
  requestDevControlAnalyzeSchema,
} from "./schemas";
import { z } from "zod";

export async function updateDevControlFlag(
  input: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: "로그인이 필요합니다" };
  const parsed = updateDevControlFlagSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("dev_control_analyses")
    .select("flags")
    .eq("id", parsed.data.analysisId)
    .single();
  if (error) return { ok: false, error: error.message };

  const parsedFlags = z.array(devControlFlagSchema).safeParse(data.flags);
  if (!parsedFlags.success)
    return { ok: false, error: "저장된 플래그 형식이 올바르지 않습니다" };

  const flags = parsedFlags.data;
  const next = flags.map((f) =>
    f.key === parsed.data.flagKey
      ? { ...f, checked: parsed.data.checked, note: parsed.data.note }
      : f,
  );
  const { error: upErr } = await admin
    .from("dev_control_analyses")
    .update({ flags: next })
    .eq("id", parsed.data.analysisId);
  if (upErr) return { ok: false, error: upErr.message };
  revalidatePath("/dashboard/dev-test");
  return { ok: true };
}

export async function requestDevControlAnalyze(
  input: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: "로그인이 필요합니다" };
  const parsed = requestDevControlAnalyzeSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { data: existing, error: qErr } = await admin
    .from("dev_control_analyze_requests")
    .select("id")
    .eq("service_id", parsed.data.serviceId)
    .in("status", ["pending", "running"])
    .limit(1);
  if (qErr) return { ok: false, error: qErr.message };
  if (existing && existing.length > 0)
    return { ok: false, error: "이미 분석 대기/진행 중입니다" };

  const { error } = await admin
    .from("dev_control_analyze_requests")
    .insert({
      service_id: parsed.data.serviceId,
      requested_by: me.displayName ?? me.email ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/dev-test");
  return { ok: true };
}
