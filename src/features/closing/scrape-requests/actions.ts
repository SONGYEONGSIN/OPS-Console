"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/features/auth/permission";
import { createAdminClient } from "@/lib/supabase/admin";

export type RequestActionState = { ok: boolean; message: string } | undefined;

/**
 * 서비스 마감 '로컬 수동 실행' 요청 — pending 1건 적재 (admin only).
 * 회사 PC 폴러가 claim해 run-local 실행 후 완료 보고한다.
 * 이미 대기/진행 중인 요청이 있으면 중복 적재를 막는다.
 */
export async function requestLocalScrapeAction(
  _prev: RequestActionState,
  _formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const me = await requireAdmin();
  const admin = createAdminClient();

  const { data: existing, error: selErr } = await admin
    .from("closing_scrape_requests")
    .select("id")
    .in("status", ["pending", "running"])
    .limit(1);
  if (selErr) return { ok: false, message: selErr.message };
  if (existing && existing.length > 0) {
    return {
      ok: false,
      message:
        "이미 대기/진행 중인 요청이 있습니다. 회사 PC 폴러 처리를 기다려 주세요.",
    };
  }

  const { error } = await admin
    .from("closing_scrape_requests")
    .insert({ requested_by: me.email, status: "pending" });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/automations");
  return {
    ok: true,
    message:
      "로컬 실행을 요청했습니다. 회사 PC 폴러가 곧 실행합니다(최대 5분).",
  };
}
