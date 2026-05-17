import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { listMyTodos } from "@/features/todos/queries";
import {
  createTodo,
  deleteTodo,
  toggleTodoDone,
} from "@/features/todos/actions";
import { listUpcomingForOperator } from "@/features/services/queries";
import {
  MyTodoLayout,
  type UpcomingService,
  type TodoItem,
} from "./MyTodoLayout";

const WINDOW_DAYS = 60;

/**
 * /dashboard/my-todo — 본인 담당 서비스(D-60) 기반 todo planner.
 * 왼쪽: services.write_start_at 임박 본인 분
 * 오른쪽: todos 누적 (드래그 또는 '+ 담기'로 등록)
 */
export default async function MyTodoPage() {
  const slug = "my-todo";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;

  const me = await getCurrentOperator();
  const services = me?.email
    ? await listUpcomingForOperator(me.email, WINDOW_DAYS)
    : [];
  const todos = await listMyTodos();

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

  const upcoming: UpcomingService[] = services
    .filter((s) => s.write_start_at !== null)
    .map((s) => ({
      id: s.id,
      service_id: s.service_id,
      university_name: s.university_name,
      service_name: s.service_name,
      application_type: s.application_type,
      write_start_at: s.write_start_at as string,
    }));

  const todoItems: TodoItem[] = todos.map((t) => ({
    id: t.id,
    title: t.title,
    body: t.body ?? null,
    done: t.done,
    done_at: t.done_at ?? null,
    priority: t.priority,
    source_service_id: t.source_service_id ?? null,
  }));

  async function onAddFromService(
    service: UpcomingService,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    const meNow = await getCurrentOperator();
    if (!meNow?.email) return { ok: false, error: "로그인이 필요합니다." };
    const r = await createTodo({
      title: `${service.university_name} · ${service.service_name}`,
      body: `${service.application_type} · 접수 시작 ${service.write_start_at}`,
      priority: "medium",
      due_at: service.write_start_at,
      assignee_email: meNow.email,
      created_by_email: meNow.email,
      source_service_id: service.id,
    });
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  async function onToggleDone(
    id: string,
    done: boolean,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    const r = await toggleTodoDone(id, done);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  async function onDeleteTodo(
    id: string,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    const r = await deleteTodo(id);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  return (
    <div className="flex flex-col">
      {header}
      <MyTodoLayout
        services={upcoming}
        todos={todoItems}
        onAddFromService={onAddFromService}
        onToggleDone={onToggleDone}
        onDeleteTodo={onDeleteTodo}
      />
    </div>
  );
}
