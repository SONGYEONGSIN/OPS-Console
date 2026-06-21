"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOperator } from "@/features/auth/queries";
import { buildSeedDoc } from "./form-templates";
import { meetingMetaSchema, type MeetingType } from "./schemas";
import { canRevokeSend } from "./actions-guard";

const PATH = "/dashboard/meetings";

export async function createMeeting(
  type: MeetingType,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const me = await getCurrentOperator();
  if (!me?.email) return { ok: false, error: "인증이 필요합니다." };
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("meetings")
    .insert({ type, author_email: me.email, content: buildSeedDoc(type) })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true, id: data.id as string };
}

export async function updateMeetingMeta(
  id: string,
  raw: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentOperator();
  if (!me?.email) return { ok: false, error: "인증이 필요합니다." };
  const parsed = meetingMetaSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("meetings")
    .update(parsed.data)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`${PATH}/${id}`);
  revalidatePath(PATH);
  return { ok: true };
}

export async function saveMeetingContent(
  id: string,
  content: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentOperator();
  if (!me?.email) return { ok: false, error: "인증이 필요합니다." };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("meetings")
    .update({ content })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteMeeting(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentOperator();
  if (!me?.email) return { ok: false, error: "인증이 필요합니다." };
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("meetings")
    .select("author_email")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false, error: "회의록을 찾을 수 없습니다." };
  const isOwner = row.author_email === me.email;
  if (!isOwner && me.permission !== "admin")
    return { ok: false, error: "권한이 없습니다." };
  const { error } = await supabase.from("meetings").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function revokeSendMeeting(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentOperator();
  if (!me?.email) return { ok: false, error: "인증이 필요합니다." };
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("meetings")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!data || !canRevokeSend(data.status))
    return { ok: false, error: "발송완료 상태만 취소할 수 있습니다." };
  const { error } = await supabase
    .from("meetings")
    .update({ status: "draft" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`${PATH}/${id}`);
  revalidatePath(PATH);
  return { ok: true };
}
