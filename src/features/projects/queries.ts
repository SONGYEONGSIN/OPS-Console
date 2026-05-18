import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  projectRowSchema,
  projectTaskRowSchema,
  type ProjectRow,
  type ProjectTaskRow,
} from "./schemas";

/**
 * 본인 projects만 fetch (RSC). RLS는 created_by 본인 only이지만 UI는 owner_email도 본인 강제.
 * 정렬: start_at asc nulls last → created_at desc.
 */
export async function listMyProjects(): Promise<ProjectRow[]> {
  const me = await getCurrentOperator();
  if (!me) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("created_by_email", me.email)
    .order("start_at", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[listMyProjects] supabase error:", error);
    return [];
  }

  const parsed: ProjectRow[] = [];
  for (const row of data ?? []) {
    const r = projectRowSchema.safeParse(row);
    if (r.success) parsed.push(r.data);
    else
      console.error(
        "[listMyProjects] zod parse fail:",
        r.error.issues,
        "row:",
        row,
      );
  }
  return parsed;
}

/**
 * 단일 project의 sub-task 목록. RLS가 parent EXISTS로 본인 only 강제.
 */
export async function listProjectTasks(
  projectId: string,
): Promise<ProjectTaskRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("start_at", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[listProjectTasks] supabase error:", error);
    return [];
  }

  const parsed: ProjectTaskRow[] = [];
  for (const row of data ?? []) {
    const r = projectTaskRowSchema.safeParse(row);
    if (r.success) parsed.push(r.data);
    else
      console.error(
        "[listProjectTasks] zod parse fail:",
        r.error.issues,
        "row:",
        row,
      );
  }
  return parsed;
}

export type ProjectWithTasks = {
  project: ProjectRow;
  tasks: ProjectTaskRow[];
};

/**
 * 본인 projects + 각 sub-task 병합. ProjectView·GanttChart에 한 번에 전달.
 * 2 쿼리 (projects then tasks IN project_ids) 후 client-side join.
 */
export async function listMyProjectsWithTasks(): Promise<ProjectWithTasks[]> {
  const projects = await listMyProjects();
  if (projects.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_tasks")
    .select("*")
    .in(
      "project_id",
      projects.map((p) => p.id),
    )
    .order("start_at", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[listMyProjectsWithTasks] tasks fetch error:", error);
    return projects.map((p) => ({ project: p, tasks: [] }));
  }

  const tasksByProject = new Map<string, ProjectTaskRow[]>();
  for (const row of data ?? []) {
    const r = projectTaskRowSchema.safeParse(row);
    if (!r.success) {
      console.error(
        "[listMyProjectsWithTasks] task parse fail:",
        r.error.issues,
        "row:",
        row,
      );
      continue;
    }
    const list = tasksByProject.get(r.data.project_id);
    if (list) list.push(r.data);
    else tasksByProject.set(r.data.project_id, [r.data]);
  }

  return projects.map((p) => ({
    project: p,
    tasks: tasksByProject.get(p.id) ?? [],
  }));
}
