import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { listMyTodos } from "@/features/todos/queries";
import { listServicesForCalendar } from "@/features/services/queries";
import {
  createTodo,
  updateTodo,
  deleteTodo,
  syncApplicationTodos,
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
import { getKstWeekStart, getKstWeekDays } from "./_helpers/week-grid";
import type { ListRow } from "../_components/patterns/ListPattern";

type SearchParams = Promise<{ tab?: string; week?: string; mine?: string }>;

const KST_TODAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
});

function getTodayKstYmd(): string {
  return KST_TODAY.format(new Date());
}

/**
 * 운영부 달력과 동일 — services 데이터가 작년(2025) 기준이라 fetch range -1년 + 표시 +1년 shift.
 */
const SERVICES_YEAR_OFFSET = 1;

function shiftYmdYear(ymd: string | null, delta: number): string | null {
  if (!ymd) return null;
  const m = /^(\d{4})(.*)$/.exec(ymd);
  if (!m) return ymd;
  return `${Number(m[1]) + delta}${m[2]}`;
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
  const weekAnchor = sp.week ?? getTodayKstYmd();
  const weekStartYmd = getKstWeekStart(weekAnchor);

  // Weekly grid 2주 범위 services fetch (-1년 shift)
  const weekDays = getKstWeekDays(weekStartYmd);
  const fetchStart = shiftYmdYear(weekDays[0] ?? null, -SERVICES_YEAR_OFFSET);
  const fetchEnd = shiftYmdYear(
    weekDays[weekDays.length - 1] ?? null,
    -SERVICES_YEAR_OFFSET,
  );
  const servicesRaw =
    activeTab === "weekly" && fetchStart && fetchEnd
      ? await listServicesForCalendar(fetchStart, fetchEnd)
      : [];
  const mineOnly = sp.mine !== "false";
  const myEmail = me?.email ?? "";
  const servicesFiltered = mineOnly
    ? servicesRaw.filter(
        (s) => s.operator_email === myEmail || s.developer_email === myEmail,
      )
    : servicesRaw;
  const services = servicesFiltered.map((s) => ({
    ...s,
    write_start_at: shiftYmdYear(s.write_start_at, SERVICES_YEAR_OFFSET),
    write_end_at: shiftYmdYear(s.write_end_at, SERVICES_YEAR_OFFSET),
  }));

  // 원서접수 services를 주요업무로 자동 동기화(멱등) 후 todos 조회 → 자동 생성분 즉시 반영.
  // 진입 시 자동 — 실패해도 조용히 0건(페이지 무중단). 삭제된 항목은 재생성 안 함.
  if (activeTab === "weekly") {
    await syncApplicationTodos(services);
  }
  const todos = activeTab === "weekly" ? await listMyTodos() : [];

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
      // 자동 등록(원서접수) 항목은 soft-delete(auto_dismissed) → 재생성 방지 + '삭제됨'으로 추적.
      // 수동 todo는 종전대로 hard delete.
      if (row.sourceServiceId) {
        const r = await updateTodo(row.id, { auto_dismissed: true });
        return r.ok ? { ok: true } : { ok: false, error: r.error };
      }
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

    // 빈 text 체크리스트 항목은 저장 전 제거 (사용자가 '+ 항목 추가' 후 입력 없이 저장한 케이스).
    // zod schema의 text.min(1) 검증 통과를 위해 server 호출 전 필터링.
    const cleanedChecklist = (row.taskChecklist ?? [])
      .map((c) => ({ ...c, text: c.text.trim() }))
      .filter((c) => c.text.length > 0);

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
        checklist: cleanedChecklist,
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
      checklist: cleanedChecklist,
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
            services={services}
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
