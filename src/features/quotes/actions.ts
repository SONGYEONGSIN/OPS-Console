"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { quoteInputSchema, type QuoteInput } from "./schemas";

const PATH = "/dashboard/quotes";
type Result = { ok: boolean; error?: string };

export async function createQuote(input: QuoteInput): Promise<Result> {
  const parsed = quoteInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").insert({
    ...parsed.data,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function updateQuote(
  id: string,
  input: QuoteInput,
): Promise<Result> {
  if (!id) return { ok: false, error: "id가 없습니다." };
  const parsed = quoteInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("quotes")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteQuote(id: string): Promise<Result> {
  if (!id) return { ok: false, error: "id가 없습니다." };
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}
