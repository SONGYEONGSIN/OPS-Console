"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/features/worklog/log";
import {
  getCurrentOperator,
  type CurrentOperator,
} from "@/features/auth/queries";
import {
  contactCreateSchema,
  contactUpdateSchema,
  type ContactRow,
} from "./schemas";

export type ContactsActionResult =
  | { ok: true; row: ContactRow }
  | { ok: false; error: string };

const PERMISSION_ERROR =
  "권한 없음 — 대학 연락처 등록·수정·삭제 권한이 없습니다.";
const CONTACTS_PATH = "/dashboard/contacts";

function isOperator(me: CurrentOperator | null): boolean {
  if (!me) return false;
  return me.permission === "admin" || me.permission === "member";
}

export async function createContact(
  input: unknown,
): Promise<ContactsActionResult> {
  const parsed = contactCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const me = await getCurrentOperator();
  if (!isOperator(me)) {
    return { ok: false, error: PERMISSION_ERROR };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .insert(parsed.data)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  await logActivity({
    domain: "contacts",
    action: "create",
    target_type: "contacts",
    target_id: data.id,
    target_name: `${data.university_name} · ${data.customer_name}`,
    msg: `대학 연락처 등록`,
  });
  revalidatePath(CONTACTS_PATH);
  return { ok: true, row: data as ContactRow };
}

export async function updateContact(
  id: string,
  input: unknown,
): Promise<ContactsActionResult> {
  const parsed = contactUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const me = await getCurrentOperator();
  if (!isOperator(me)) {
    return { ok: false, error: PERMISSION_ERROR };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  await logActivity({
    domain: "contacts",
    action: "update",
    target_type: "contacts",
    target_id: id,
    target_name: `${data.university_name} · ${data.customer_name}`,
    msg: `대학 연락처 수정`,
    metadata: parsed.data,
  });
  revalidatePath(CONTACTS_PATH);
  return { ok: true, row: data as ContactRow };
}

export async function deleteContact(
  id: string,
): Promise<ContactsActionResult> {
  const me = await getCurrentOperator();
  if (!isOperator(me)) {
    return { ok: false, error: PERMISSION_ERROR };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  await logActivity({
    domain: "contacts",
    action: "delete",
    target_type: "contacts",
    target_id: id,
    target_name: data ? `${data.university_name} · ${data.customer_name}` : id,
    level: "WARN",
    msg: `대학 연락처 삭제`,
  });
  revalidatePath(CONTACTS_PATH);
  return { ok: true, row: data as ContactRow };
}
