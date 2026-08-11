"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAiTip } from "@/features/ai-tips/actions";

const AI_TIPS_PATH = "/dashboard/ai-tips";
const PERMISSION_ERROR = "권한 없음 — TIP 등록 권한이 없습니다.";
const NOT_FOUND_ERROR = "후보를 찾을 수 없습니다.";

export type CandidateActionResult = { ok: boolean; error?: string };

async function canEdit(): Promise<boolean> {
  const me = await getCurrentOperator();
  if (!me) return false;
  return me.permission !== "viewer" && me.permission !== null;
}

/**
 * 후보를 TIP으로 등록한다. 초안이 없으면 리포 정보로 최소값을 채운다 —
 * ai_tips는 summary_md·reuse_prompt가 필수라 빈 값으로는 저장되지 않는다.
 * TIP 생성이 실패하면 후보 상태를 바꾸지 않는다(다시 시도할 수 있어야 한다).
 */
export async function promoteCandidate(
  id: string,
): Promise<CandidateActionResult> {
  if (!(await canEdit())) return { ok: false, error: PERMISSION_ERROR };

  const supabase = await createClient();
  const { data: c } = await supabase
    .from("ai_tip_candidates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!c) return { ok: false, error: NOT_FOUND_ERROR };

  const created = await createAiTip({
    title: c.draft_title ?? `GitHub: ${c.repo_full_name}`,
    ai_tool: c.draft_ai_tool ?? "etc",
    category: c.draft_category ?? "automation",
    summary_md:
      c.draft_summary_md ??
      `${c.repo_description ?? c.repo_full_name}\n\n${c.repo_url}`,
    reuse_prompt:
      c.draft_reuse_prompt ??
      `${c.repo_url} 를 참고해 우리 업무에 적용할 방법을 정리해줘.`,
    tags: c.draft_tags ?? [],
  });
  if (!created.ok) return { ok: false, error: created.error };

  const { error } = await supabase
    .from("ai_tip_candidates")
    .update({ status: "promoted" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(AI_TIPS_PATH);
  return { ok: true };
}

/** 공유할 만하지 않은 후보를 숨긴다. 숨긴 리포는 다음 회차 수집에서도 제외된다. */
export async function hideCandidate(
  id: string,
): Promise<CandidateActionResult> {
  if (!(await canEdit())) return { ok: false, error: PERMISSION_ERROR };

  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_tip_candidates")
    .update({ status: "hidden" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(AI_TIPS_PATH);
  return { ok: true };
}
