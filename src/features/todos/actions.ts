"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/features/auth/queries";
import { todoCreateSchema, todoUpdateSchema, type TodoRow } from "./schemas";
import { syncTodoCompletion } from "./completion-sync";
import { computeMissingApplicationTodos } from "./application-sync";
import type { ServicesRow } from "@/features/services/schemas";

export type TodoActionResult =
  | { ok: true; row: TodoRow }
  | { ok: false; error: string };

const PERMISSION_ERROR_VIEWER = "권한 없음 — todo 작성 권한이 없습니다.";
const NOT_FOUND_ERROR = "todo를 찾을 수 없습니다.";

const TODO_PATH = "/dashboard/my-todo";

export async function createTodo(input: unknown): Promise<TodoActionResult> {
  const parsed = todoCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const me = await getCurrentOperator();
  if (!me || me.permission === "viewer" || me.permission === null) {
    return { ok: false, error: PERMISSION_ERROR_VIEWER };
  }

  // 위임 차단 — assignee/created_by 모두 본인으로 강제 (스코프 외 기능)
  // status='done'으로 생성 시 done/done_at도 일치(완료 항목 기록 시 체크 상태 일관).
  const payload = {
    ...parsed.data,
    ...syncTodoCompletion(parsed.data, new Date().toISOString()),
    assignee_email: me.email,
    created_by_email: me.email,
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("todos")
    .insert(payload)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath(TODO_PATH);
  return { ok: true, row: data as TodoRow };
}

export async function updateTodo(
  id: string,
  input: unknown,
): Promise<TodoActionResult> {
  const parsed = todoUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  // 상태값(status='done') ↔ 완료 체크(done) 양방향 동기화 — 둘 중 하나만 바꿔도 일치 유지.
  const synced = syncTodoCompletion(parsed.data, new Date().toISOString());

  // RLS가 본인 외 차단. 행 존재 여부만 체크.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("todos")
    .update(synced)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: NOT_FOUND_ERROR };
  revalidatePath(TODO_PATH);
  return { ok: true, row: data as TodoRow };
}

export async function deleteTodo(id: string): Promise<TodoActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("todos")
    .delete()
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: NOT_FOUND_ERROR };
  revalidatePath(TODO_PATH);
  return { ok: true, row: data as TodoRow };
}

/**
 * 원서접수 services → 주요업무(todos) 자동 동기화.
 *
 * 본인 담당 services 중 아직 todo로 연결 안 된 것을 일괄 생성한다(멱등 — source_service_id 존재 시 skip,
 * 삭제됨 항목 포함하여 재생성 안 함). my-todo weekly 페이지 진입 시 호출. 진입 자동이므로 실패해도
 * 페이지를 깨지 않고 0건으로 반환(다음 진입에 재시도).
 */
export async function syncApplicationTodos(
  services: ServicesRow[],
): Promise<{ created: number }> {
  try {
    const me = await getCurrentOperator();
    if (!me || me.permission === "viewer" || me.permission === null) {
      return { created: 0 };
    }
    const mine = services.filter(
      (s) => s.operator_email === me.email || s.developer_email === me.email,
    );
    if (mine.length === 0) return { created: 0 };

    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("todos")
      .select("source_service_id")
      .not("source_service_id", "is", null);

    const payloads = computeMissingApplicationTodos(
      mine,
      existing ?? [],
      me.email,
    );
    if (payloads.length === 0) return { created: 0 };

    const { data, error } = await supabase
      .from("todos")
      .insert(payloads)
      .select("id");
    if (error) {
      console.error("[syncApplicationTodos] insert error:", error.message);
      return { created: 0 };
    }
    revalidatePath(TODO_PATH);
    return { created: data?.length ?? 0 };
  } catch (e) {
    console.error("[syncApplicationTodos] failed:", e);
    return { created: 0 };
  }
}

/**
 * done 체크박스 빠른 토글. updateTodo의 specialised 변형.
 * done=true 시 done_at=now, done=false 시 done_at=null.
 */
export async function toggleTodoDone(
  id: string,
  done: boolean,
): Promise<TodoActionResult> {
  return updateTodo(id, {
    done,
    done_at: done ? new Date().toISOString() : null,
  });
}
