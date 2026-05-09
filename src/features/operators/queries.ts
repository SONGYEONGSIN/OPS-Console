import "server-only";
import { createClient } from "@/lib/supabase/server";
import { operatorRowSchema, type OperatorRow } from "./schemas";

/**
 * 운영부 조직 전체 fetch (RSC).
 * RLS: authenticated → 모든 row read.
 */
export async function listOperators(): Promise<OperatorRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operators")
    .select("*")
    .order("team", { ascending: true })
    .order("hired_at", { ascending: true });

  if (error) {
    console.error("listOperators failed:", error.message);
    return [];
  }

  const parsed: OperatorRow[] = [];
  for (const row of data ?? []) {
    const r = operatorRowSchema.safeParse(row);
    if (r.success) parsed.push(r.data);
  }
  return parsed;
}

export async function getOperatorById(
  id: string,
): Promise<OperatorRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operators")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  const r = operatorRowSchema.safeParse(data);
  return r.success ? r.data : null;
}
