"use server";

import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { FILE_DRAFT_CONTEXT } from "./file-draft-shared";

export type RunningFileDraft = { id: string; question: string };

/**
 * 아직 도는 중인 내 '파일로 초안' 요청.
 *
 * 탭이 URL 이라 다른 탭에 다녀오면 초안 화면이 통째로 죽는다. 돌아왔을 때 이걸로
 * 이어받지 않으면 답이 사라져, **되묻기를 아무도 못 보던 문제가 그대로 재발한다**.
 *
 * **끝난 요청은 안 가져온다.** 어제 답이 오늘 화면에 떠 있으면 방금 것인 줄 알고
 * 읽는다 — 이어받는 것은 '지금 기다리는 중'인 것뿐이다.
 */
export async function getRunningFileDraft(): Promise<RunningFileDraft | null> {
  const me = await getCurrentOperator();
  if (!me) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("assistant_requests")
    .select("id, question")
    .eq("operator_email", me.email)
    .eq("page_context", FILE_DRAFT_CONTEXT)
    .in("status", ["pending", "running"])
    .order("requested_at", { ascending: false })
    .limit(1);

  const row = data?.[0];
  if (!row) return null;
  return { id: row.id as string, question: row.question as string };
}
