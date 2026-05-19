import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { listMyTodos } from "@/features/todos/queries";
import {
  createTodo,
  updateTodo,
  deleteTodo,
} from "@/features/todos/actions";
import { listMyProjectsWithTasks } from "@/features/projects/queries";
import {
  createProject,
  updateProject,
  deleteProject,
  createProjectTask,
  updateProjectTask,
  deleteProjectTask,
} from "@/features/projects/actions";
import { MyTodoTabs } from "./MyTodoTabs";
import { WeeklyView } from "./WeeklyView";
import { ProjectView } from "./ProjectView";
import { getKstWeekStart } from "./_helpers/week-grid";
import type { ListRow } from "../_components/patterns/ListPattern";

type SearchParams = Promise<{ tab?: string; week?: string }>;

const KST_TODAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
});

function getTodayKstYmd(): string {
  return KST_TODAY.format(new Date());
}

export default async function MyTodoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const slug = "my-todo";
  await requireMenu(slug);
  const meta = findSidebarMeta(slug);
  if (!meta) return null;

  const sp = await searchParams;
  const activeTab = sp.tab === "project" ? "project" : "weekly";

  const me = await getCurrentOperator();
  const canWrite = me?.permission !== "viewer" && me?.permission !== null;

  // Tab1 — Weekly
  const todos = activeTab === "weekly" ? await listMyTodos() : [];
  const weekAnchor = sp.week ?? getTodayKstYmd();
  const weekStartYmd = getKstWeekStart(weekAnchor);

  // Tab2 — Projects
  const projectsWithTasks =
    activeTab === "project" ? await listMyProjectsWithTasks() : [];

  const pathname = `/dashboard/${slug}`;
  const config = resolvePageMeta(slug, meta, todos.length);

  const header = (
    <PageHeader
      pathname={pathname}
      meta={config.meta}
      headline={config.headline}
      description={config.description}
      autoRefresh
    />
  );

  // ─── Server Actions

  async function onPersistTodo(
    row: ListRow,
    isNew: boolean,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    const operator = await getCurrentOperator();
    if (!operator?.email) return { ok: false, error: "로그인이 필요합니다." };
    if (isNew) {
      const r = await createTodo({
        title: row.name,
        body: row.body ?? null,
        priority: row.priority ?? "medium",
        due_at: row.dueAt ?? null,
        category: row.category ?? null,
        progress: row.progress ?? null,
        status: row.todoStatus ?? null,
        assignee_email: operator.email,
        created_by_email: operator.email,
      });
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }
    if (row.status === "deleted") {
      const r = await deleteTodo(row.id);
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }
    const r = await updateTodo(row.id, {
      title: row.name,
      body: row.body ?? null,
      done: row.done,
      done_at: row.doneAt ?? null,
      due_at: row.dueAt ?? null,
      priority: row.priority,
      category: row.category ?? null,
      progress: row.progress ?? null,
      status: row.todoStatus ?? null,
    });
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  async function onPersistProject(
    row: ListRow,
    isNew: boolean,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    const operator = await getCurrentOperator();
    if (!operator?.email) return { ok: false, error: "로그인이 필요합니다." };
    if (isNew) {
      const r = await createProject({
        name: row.name,
        description: row.description ?? null,
        owner_email: row.projectOwnerEmail ?? operator.email,
        start_at: row.startDateYmd ?? null,
        end_at: row.endDateYmd ?? null,
        priority: row.priority ?? "medium",
        progress: row.progress ?? 0,
        status: row.todoStatus ?? "todo",
        created_by_email: operator.email,
      });
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }
    if (row.status === "deleted") {
      const r = await deleteProject(row.id);
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }
    const r = await updateProject(row.id, {
      name: row.name,
      description: row.description ?? null,
      owner_email: row.projectOwnerEmail ?? operator.email,
      start_at: row.startDateYmd ?? null,
      end_at: row.endDateYmd ?? null,
      priority: row.priority,
      progress: row.progress ?? 0,
      status: row.todoStatus ?? "todo",
    });
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  async function onPersistTask(
    row: ListRow,
    isNew: boolean,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    const operator = await getCurrentOperator();
    if (!operator?.email) return { ok: false, error: "로그인이 필요합니다." };
    if (isNew) {
      if (!row.projectId)
        return { ok: false, error: "프로젝트 선택이 필요합니다." };
      const r = await createProjectTask({
        project_id: row.projectId,
        name: row.name,
        assignee_email: row.taskAssigneeEmail ?? null,
        start_at: row.startDateYmd ?? null,
        end_at: row.endDateYmd ?? null,
        priority: row.priority ?? "medium",
        progress: row.progress ?? 0,
        status: row.todoStatus ?? "todo",
        created_by_email: operator.email,
      });
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }
    if (row.status === "deleted") {
      const r = await deleteProjectTask(row.id);
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }
    const r = await updateProjectTask(row.id, {
      name: row.name,
      assignee_email: row.taskAssigneeEmail ?? null,
      start_at: row.startDateYmd ?? null,
      end_at: row.endDateYmd ?? null,
      priority: row.priority,
      progress: row.progress ?? 0,
      status: row.todoStatus ?? "todo",
    });
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  return (
    <>
      {header}
      <MyTodoTabs
        activeTab={activeTab}
        weeklyContent={
          <WeeklyView
            todos={todos}
            weekStartYmd={weekStartYmd}
            canWrite={canWrite}
            todayYmd={getTodayKstYmd()}
            onPersist={onPersistTodo}
          />
        }
        projectContent={
          <ProjectView
            projectsWithTasks={projectsWithTasks}
            canWrite={canWrite}
            onPersistProject={onPersistProject}
            onPersistTask={onPersistTask}
          />
        }
      />
    </>
  );
}
