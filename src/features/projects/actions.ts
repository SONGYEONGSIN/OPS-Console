"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  projectCreateSchema,
  projectUpdateSchema,
  projectTaskCreateSchema,
  projectTaskUpdateSchema,
  type ProjectRow,
  type ProjectTaskRow,
} from "./schemas";

export type ProjectActionResult =
  | { ok: true; row: ProjectRow }
  | { ok: false; error: string };

export type ProjectTaskActionResult =
  | { ok: true; row: ProjectTaskRow }
  | { ok: false; error: string };

const PERMISSION_ERROR_VIEWER = "권한 없음 — 프로젝트 작성 권한이 없습니다.";
const NOT_FOUND_ERROR = "프로젝트를 찾을 수 없습니다.";
const TASK_NOT_FOUND_ERROR = "sub-task를 찾을 수 없습니다.";

const MY_TODO_PATH = "/dashboard/my-todo";

function isWriter(permission: string | null | undefined): boolean {
  return permission !== "viewer" && permission !== null && permission !== undefined;
}

// ─── projects

export async function createProject(input: unknown): Promise<ProjectActionResult> {
  const parsed = projectCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const me = await getCurrentOperator();
  if (!me || !isWriter(me.permission)) {
    return { ok: false, error: PERMISSION_ERROR_VIEWER };
  }

  // 본인 강제 — created_by_email은 me.email로 덮어쓰기 (spoof 방지)
  const payload = {
    ...parsed.data,
    created_by_email: me.email,
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert(payload)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath(MY_TODO_PATH);
  return { ok: true, row: data as ProjectRow };
}

export async function updateProject(
  id: string,
  input: unknown,
): Promise<ProjectActionResult> {
  const parsed = projectUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: NOT_FOUND_ERROR };
  revalidatePath(MY_TODO_PATH);
  return { ok: true, row: data as ProjectRow };
}

export async function deleteProject(id: string): Promise<ProjectActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: NOT_FOUND_ERROR };
  revalidatePath(MY_TODO_PATH);
  return { ok: true, row: data as ProjectRow };
}

// ─── project_tasks

export async function createProjectTask(
  input: unknown,
): Promise<ProjectTaskActionResult> {
  const parsed = projectTaskCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const me = await getCurrentOperator();
  if (!me || !isWriter(me.permission)) {
    return { ok: false, error: PERMISSION_ERROR_VIEWER };
  }

  const payload = {
    ...parsed.data,
    created_by_email: me.email,
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_tasks")
    .insert(payload)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath(MY_TODO_PATH);
  return { ok: true, row: data as ProjectTaskRow };
}

export async function updateProjectTask(
  id: string,
  input: unknown,
): Promise<ProjectTaskActionResult> {
  const parsed = projectTaskUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_tasks")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: TASK_NOT_FOUND_ERROR };
  revalidatePath(MY_TODO_PATH);
  return { ok: true, row: data as ProjectTaskRow };
}

export async function deleteProjectTask(
  id: string,
): Promise<ProjectTaskActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_tasks")
    .delete()
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: TASK_NOT_FOUND_ERROR };
  revalidatePath(MY_TODO_PATH);
  return { ok: true, row: data as ProjectTaskRow };
}
