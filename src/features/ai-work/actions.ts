"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentOperator,
  type CurrentOperator,
} from "@/features/auth/queries";
import {
  aiWorkCreateSchema,
  aiWorkUpdateSchema,
  type AiWorkRow,
} from "./schemas";

export type AiWorkActionResult =
  | { ok: true; row: AiWorkRow }
  | { ok: false; error: string };

const PERMISSION_ERROR_VIEWER = "권한 없음 — AI 활용 등록 권한이 없습니다.";
const PERMISSION_ERROR_AUTHOR = "권한 없음 — 본인이 작성한 항목이 아닙니다.";
const NOT_FOUND_ERROR = "항목을 찾을 수 없습니다.";
const AI_WORK_PATH = "/dashboard/my-ai-work";

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

export async function createAiWork(input: unknown): Promise<AiWorkActionResult> {
  const parsed = aiWorkCreateSchema.safeParse(input);
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
    .from("ai_work")
    .insert(payload)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath(AI_WORK_PATH);
  return { ok: true, row: data as AiWorkRow };
}

export async function updateAiWork(
  id: string,
  input: unknown,
): Promise<AiWorkActionResult> {
  const parsed = aiWorkUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const me = await getCurrentOperator();
  const supabase = await createClient();

  const { data: target } = await supabase
    .from("ai_work")
    .select("author_email")
    .eq("id", id)
    .maybeSingle();
  if (!target) return { ok: false, error: NOT_FOUND_ERROR };

  if (!canEdit(target.author_email as string, me)) {
    return { ok: false, error: PERMISSION_ERROR_AUTHOR };
  }

  const { data, error } = await supabase
    .from("ai_work")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath(AI_WORK_PATH);
  return { ok: true, row: data as AiWorkRow };
}

export async function deleteAiWork(id: string): Promise<AiWorkActionResult> {
  const me = await getCurrentOperator();
  const supabase = await createClient();

  const { data: target } = await supabase
    .from("ai_work")
    .select("author_email")
    .eq("id", id)
    .maybeSingle();
  if (!target) return { ok: false, error: NOT_FOUND_ERROR };

  if (!canEdit(target.author_email as string, me)) {
    return { ok: false, error: PERMISSION_ERROR_AUTHOR };
  }

  const { data, error } = await supabase
    .from("ai_work")
    .delete()
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  revalidatePath(AI_WORK_PATH);
  return { ok: true, row: data as AiWorkRow };
}
