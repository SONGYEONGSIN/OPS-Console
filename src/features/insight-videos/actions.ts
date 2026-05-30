"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOperator } from "@/features/auth/queries";
import { logActivity } from "@/features/worklog/log";
import type { InsightVideoRow } from "./schemas";

export type InsightVideoActionResult =
  | { ok: true; row: Pick<InsightVideoRow, "id" | "title"> }
  | { ok: false; error: string };

const PERMISSION_ERROR = "권한 없음 — 인사이트 영상 삭제는 관리자만 가능합니다.";
const INVALID_ID_ERROR = "잘못된 영상 식별자입니다.";
const NOT_FOUND_ERROR = "영상을 찾을 수 없습니다 (이미 삭제됨).";
const AI_INSIGHT_PATH = "/dashboard/ai-insight";

const idSchema = z.string().uuid();

/**
 * 인사이트 영상 삭제 — admin 전용.
 *
 * insight_videos는 DELETE RLS 정책이 없어(자동 차단) authenticated client로는
 * 지울 수 없다. admin 컨텍스트에서만 호출되므로 service_role(admin client)로 삭제한다.
 * 동일 video_id는 다음 수집 cron(upsert)에서 다시 적재될 수 있다.
 */
export async function deleteInsightVideo(
  id: string,
): Promise<InsightVideoActionResult> {
  const me = await getCurrentOperator();
  if (me?.permission !== "admin") {
    return { ok: false, error: PERMISSION_ERROR };
  }

  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return { ok: false, error: INVALID_ID_ERROR };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("insight_videos")
    .delete()
    .eq("id", parsed.data)
    .select("id, title")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: NOT_FOUND_ERROR };

  await logActivity({
    domain: "ai-insight",
    action: "delete",
    target_type: "insight_videos",
    target_id: parsed.data,
    target_name: data.title,
    level: "WARN",
    msg: "인사이트 영상 삭제",
  });

  revalidatePath(AI_INSIGHT_PATH);
  return { ok: true, row: data };
}
