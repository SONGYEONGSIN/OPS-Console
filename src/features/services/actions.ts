"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentOperator,
  type CurrentOperator,
} from "@/features/auth/queries";
import {
  servicesCreateSchema,
  servicesUpdateSchema,
  type ServicesRow,
} from "./schemas";

export type ServicesActionResult =
  | { ok: true; row: ServicesRow }
  | { ok: false; error: string };

const PERMISSION_ERROR = "권한 없음 — 서비스 등록·수정·삭제 권한이 없습니다.";
const DUPLICATE_SERVICE_ID_ERROR = "이미 존재하는 service_id 입니다.";
const SERVICES_PATH = "/dashboard/services";

function isOperator(me: CurrentOperator | null): boolean {
  if (!me) return false;
  return me.permission === "admin" || me.permission === "member";
}

function mapSupabaseError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return DUPLICATE_SERVICE_ID_ERROR;
  return error.message;
}

export async function createService(
  input: unknown,
): Promise<ServicesActionResult> {
  const parsed = servicesCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const me = await getCurrentOperator();
  if (!isOperator(me)) {
    return { ok: false, error: PERMISSION_ERROR };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .insert(parsed.data)
    .select()
    .single();

  if (error) return { ok: false, error: mapSupabaseError(error) };
  revalidatePath(SERVICES_PATH);
  return { ok: true, row: data as ServicesRow };
}

export async function updateService(
  id: string,
  input: unknown,
): Promise<ServicesActionResult> {
  const parsed = servicesUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const me = await getCurrentOperator();
  if (!isOperator(me)) {
    return { ok: false, error: PERMISSION_ERROR };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return { ok: false, error: mapSupabaseError(error) };
  revalidatePath(SERVICES_PATH);
  return { ok: true, row: data as ServicesRow };
}

export async function deleteService(
  id: string,
): Promise<ServicesActionResult> {
  const me = await getCurrentOperator();
  if (!isOperator(me)) {
    return { ok: false, error: PERMISSION_ERROR };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .delete()
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) return { ok: false, error: mapSupabaseError(error) };
  revalidatePath(SERVICES_PATH);
  return { ok: true, row: data as ServicesRow };
}
