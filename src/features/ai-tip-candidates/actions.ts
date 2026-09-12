"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAiTip } from "@/features/ai-tips/actions";
import { type CandidateStatus } from "./schemas";

const AI_TIPS_PATH = "/dashboard/ai-tips";
const PERMISSION_ERROR = "권한 없음 — TIP 등록 권한이 없습니다.";
const NOT_FOUND_ERROR = "후보를 찾을 수 없습니다.";
const ALREADY_PROMOTED_ERROR = "이미 등록한 후보입니다.";
const HIDDEN_PROMOTE_ERROR = "숨긴 후보입니다 — 되돌린 뒤 등록하세요.";
const PROMOTED_HIDE_ERROR = "이미 등록한 후보는 숨길 수 없습니다.";
const NOT_HIDDEN_ERROR = "숨긴 후보만 되돌릴 수 있습니다.";
const NO_ID_ERROR = "후보를 찾을 수 없습니다 — 다시 시도해 주세요.";
// ai_tips 스키마 한도(title max 80, summary_md max 500) — 초안이든 폴백이든
// 이 길이를 넘기면 createAiTip의 zod 파싱이 실패해 등록 자체가 막힌다.
const TITLE_MAX_LENGTH = 80;
const SUMMARY_MAX_LENGTH = 500;

export type CandidateActionResult = { ok: boolean; error?: string };
export type CandidateActionState = { ok: boolean; message: string } | undefined;

const idSchema = z.string().uuid();

async function canEdit(): Promise<boolean> {
  const me = await getCurrentOperator();
  if (!me) return false;
  return me.permission !== "viewer" && me.permission !== null;
}

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

/**
 * 현재 상태를 DB에서 다시 읽는다 — 화면이 보낸 status를 믿지 않는다.
 * 이 테이블 RLS는 authenticated 전원 update라 애플리케이션 가드가 유일한 방어선이다.
 */
async function loadStatus(
  id: string,
): Promise<{ status: CandidateStatus } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_tip_candidates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
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
  // 화면이 promoted·hidden까지 보여주므로 상태를 봐야 한다 —
  // 안 보면 등록된 후보를 다시 눌러 같은 TIP이 두 벌 생긴다.
  if (c.status === "promoted")
    return { ok: false, error: ALREADY_PROMOTED_ERROR };
  if (c.status === "hidden") return { ok: false, error: HIDDEN_PROMOTE_ERROR };

  const created = await createAiTip({
    title: truncate(
      c.draft_title ?? `GitHub: ${c.repo_full_name}`,
      TITLE_MAX_LENGTH,
    ),
    ai_tool: c.draft_ai_tool ?? "etc",
    category: c.draft_category ?? "automation",
    summary_md: truncate(
      c.draft_summary_md ??
        `${c.repo_description ?? c.repo_full_name}\n\n${c.repo_url}`,
      SUMMARY_MAX_LENGTH,
    ),
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

/**
 * 공유할 만하지 않은 후보를 숨긴다. 숨긴 리포는 다음 회차 수집에서도 제외되므로
 * 되돌리기(unhideCandidate)가 유일한 복구 경로다.
 * update만 하면 없는 id에도 성공을 돌려주므로 먼저 읽어 존재·상태를 본다.
 */
export async function hideCandidate(
  id: string,
): Promise<CandidateActionResult> {
  if (!(await canEdit())) return { ok: false, error: PERMISSION_ERROR };

  const c = await loadStatus(id);
  if (!c) return { ok: false, error: NOT_FOUND_ERROR };
  // 등록된 후보를 숨기면 TIP은 남는데 출처 후보만 목록에서 사라진다.
  if (c.status === "promoted") return { ok: false, error: PROMOTED_HIDE_ERROR };

  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_tip_candidates")
    .update({ status: "hidden" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(AI_TIPS_PATH);
  return { ok: true };
}

/**
 * 숨긴 후보를 검토 대기로 되돌린다.
 * 수집기가 hidden 리포를 재수집 제외 목록에 넣으므로(collect-lib.mjs pickNewRepos)
 * 잘못 누른 숨김을 풀 방법이 이 액션뿐이다.
 */
export async function unhideCandidate(
  id: string,
): Promise<CandidateActionResult> {
  if (!(await canEdit())) return { ok: false, error: PERMISSION_ERROR };

  const c = await loadStatus(id);
  if (!c) return { ok: false, error: NOT_FOUND_ERROR };
  if (c.status !== "hidden") return { ok: false, error: NOT_HIDDEN_ERROR };

  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_tip_candidates")
    .update({ status: "pending" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(AI_TIPS_PATH);
  return { ok: true };
}

/** 폼이 보낸 id — 없거나 형식이 다르면 조회 자체를 하지 않는다. */
function parseId(formData: FormData): string | null {
  const parsed = idSchema.safeParse(formData.get("id"));
  return parsed.success ? parsed.data : null;
}

function toState(
  result: CandidateActionResult,
  successMessage: string,
): { ok: boolean; message: string } {
  return result.ok
    ? { ok: true, message: successMessage }
    : { ok: false, message: result.error ?? "처리하지 못했습니다." };
}

export async function promoteCandidateAction(
  _prev: CandidateActionState,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const id = parseId(formData);
  if (!id) return { ok: false, message: NO_ID_ERROR };
  return toState(await promoteCandidate(id), "TIP으로 등록했습니다.");
}

export async function hideCandidateAction(
  _prev: CandidateActionState,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const id = parseId(formData);
  if (!id) return { ok: false, message: NO_ID_ERROR };
  return toState(await hideCandidate(id), "숨김으로 옮겼습니다.");
}

export async function unhideCandidateAction(
  _prev: CandidateActionState,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const id = parseId(formData);
  if (!id) return { ok: false, message: NO_ID_ERROR };
  return toState(await unhideCandidate(id), "검토 대기로 되돌렸습니다.");
}
