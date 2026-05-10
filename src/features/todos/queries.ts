import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/features/auth/queries";
import { todoRowSchema, type TodoRow } from "./schemas";

/**
 * 본인 todo만 fetch (RSC).
 * RLS는 admin overview 허용하지만 UI는 본인 only — assignee_email로 명시 필터.
 * 정렬: done asc(미완 먼저) → due_at asc → created_at desc.
 */
export async function listMyTodos(): Promise<TodoRow[]> {
  const me = await getCurrentOperator();
  if (!me) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("todos")
    .select("*")
    .eq("assignee_email", me.email)
    .order("done", { ascending: true });

  if (error) {
    console.error("[listMyTodos] supabase error:", error);
    return [];
  }

  const parsed: TodoRow[] = [];
  for (const row of data ?? []) {
    const r = todoRowSchema.safeParse(row);
    if (r.success) parsed.push(r.data);
    else
      console.error(
        "[listMyTodos] zod parse fail:",
        r.error.issues,
        "row:",
        row,
      );
  }
  return parsed;
}
