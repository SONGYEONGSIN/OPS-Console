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
