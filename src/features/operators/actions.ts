"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  operatorCreateSchema,
  operatorUpdateSchema,
  type OperatorRow,
} from "./schemas";

export type OperatorActionResult =
  | { ok: true; row: OperatorRow }
  | { ok: false; error: string };

export async function createOperator(
  input: unknown,
): Promise<OperatorActionResult> {
  const parsed = operatorCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operators")
    .insert(parsed.data)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/team");
  return { ok: true, row: data as OperatorRow };
}

/**
 * 삭제된 operator를 active로 복구. deleted_reason / deleted_at 초기화.
 */
export async function restoreOperator(
  id: string,
): Promise<OperatorActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operators")
    .update({ status: "active", deleted_reason: null, deleted_at: null })
    .eq("id", id)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/team-deleted");
  return { ok: true, row: data as OperatorRow };
}

export async function updateOperator(
  id: string,
  input: unknown,
): Promise<OperatorActionResult> {
  const parsed = operatorUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operators")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/team");
  return { ok: true, row: data as OperatorRow };
}
