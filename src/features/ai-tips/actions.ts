"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentOperator,
  type CurrentOperator,
} from "@/features/auth/queries";
import { logActivity } from "@/features/worklog/log";
import {
  aiTipCreateSchema,
  aiTipUpdateSchema,
  type AiTipRow,
} from "./schemas";

export type AiTipActionResult =
  | { ok: true; row: AiTipRow }
  | { ok: false; error: string };

const PERMISSION_ERROR_VIEWER = "권한 없음 — TIP 등록 권한이 없습니다.";
const PERMISSION_ERROR_AUTHOR = "권한 없음 — 본인이 작성한 항목이 아닙니다.";
const NOT_FOUND_ERROR = "TIP을 찾을 수 없습니다.";
const AI_TIPS_PATH = "/dashboard/ai-tips";

function canCreate(me: CurrentOperator | null): boolean {
  if (!me) return false;
  if (me.permission === "viewer" || me.permission === null) return false;
  return true;
}

function canEdit(authorEmail: string, me: CurrentOperator | null): boolean {
  if (!me) return false;
  if (me.permission === "admin") return true;
  return me.email === authorEmail;
}

export async function createAiTip(input: unknown): Promise<AiTipActionResult> {
  const parsed = aiTipCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const me = await getCurrentOperator();
  if (!canCreate(me)) {
    return { ok: false, error: PERMISSION_ERROR_VIEWER };
  }

  const supabase = await createClient();
  const payload = {
    ...parsed.data,
    author_email: me!.email,
  };

  const { data, error } = await supabase
    .from("ai_tips")
    .insert(payload)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };

  await logActivity({
    level: "INFO",
    domain: "ai-tips",
    action: "create",
    target_type: "ai_tip",
    target_id: data.id,
    target_name: data.title,
    msg: `TIP 등록 — ${data.title}`,
  });

  revalidatePath(AI_TIPS_PATH);
  return { ok: true, row: data as AiTipRow };
}

export async function updateAiTip(
  id: string,
  input: unknown,
): Promise<AiTipActionResult> {
  const parsed = aiTipUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const me = await getCurrentOperator();
  const supabase = await createClient();

  const { data: target } = await supabase
    .from("ai_tips")
    .select("author_email")
    .eq("id", id)
    .maybeSingle();
  if (!target) return { ok: false, error: NOT_FOUND_ERROR };

  if (!canEdit(target.author_email as string, me)) {
    return { ok: false, error: PERMISSION_ERROR_AUTHOR };
  }

  const { data, error } = await supabase
    .from("ai_tips")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath(AI_TIPS_PATH);
  return { ok: true, row: data as AiTipRow };
}

export async function deleteAiTip(id: string): Promise<AiTipActionResult> {
  const me = await getCurrentOperator();
  const supabase = await createClient();

  const { data: target } = await supabase
    .from("ai_tips")
    .select("author_email")
    .eq("id", id)
    .maybeSingle();
  if (!target) return { ok: false, error: NOT_FOUND_ERROR };

  if (!canEdit(target.author_email as string, me)) {
    return { ok: false, error: PERMISSION_ERROR_AUTHOR };
  }

  const { data, error } = await supabase
    .from("ai_tips")
    .delete()
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  revalidatePath(AI_TIPS_PATH);
  return { ok: true, row: data as AiTipRow };
}
