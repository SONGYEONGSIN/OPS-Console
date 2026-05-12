import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { listMyTodos } from "@/features/todos/queries";
import {
  createTodo,
  updateTodo,
  deleteTodo,
} from "@/features/todos/actions";
import type { TodoRow } from "@/features/todos/schemas";

/**
 * /dashboard/my-todo — 본인 전용 todo (DB 연동).
 * RLS는 admin overview 허용하지만 UI는 본인 todo만 표시 (queries에서 명시 필터).
 */
export default async function MyTodoPage() {
  const slug = "my-todo";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const todos = await listMyTodos();
  const rows: ListRow[] = todos.map(todoToListRow);
  const config = resolvePageMeta(slug, meta, rows.length);

  const me = await getCurrentOperator();
  const canWrite = me?.permission !== "viewer" && me?.permission !== null;

  const header = (
    <PageHeader
      pathname={pathname}
      meta={config.meta}
      headline={config.headline}
      description={config.description}
      autoRefresh
    />
  );

  async function onPersist(
    row: ListRow,
    isNew: boolean,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    const operator = await getCurrentOperator();
    if (isNew) {
      const result = await createTodo({
        title: row.name,
        body: row.body ?? null,
        priority: row.priority ?? "medium",
        due_at: row.dueAt ?? null,
        assignee_email: operator?.email ?? "",
        created_by_email: operator?.email ?? "",
      });
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }
    if (row.status === "deleted") {
      const result = await deleteTodo(row.id);
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }
    const result = await updateTodo(row.id, {
      title: row.name,
      body: row.body ?? null,
      priority: row.priority,
      due_at: row.dueAt ?? null,
      done: row.done ?? false,
      done_at: row.done ? (row.doneAt ?? new Date().toISOString()) : null,
    });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  return (
    <ListPattern
      title={meta.label}
      data={{ rows }}
      header={header}
      variant="my-todo"
      canCreate={canWrite}
      createLabel="+ 새 todo"
      readOnly={!canWrite}
      onPersist={onPersist}
    />
  );
}

function todoToListRow(t: TodoRow): ListRow {
  return {
    id: t.id,
    name: t.title,
    body: t.body ?? undefined,
    status: "active",
    owner: "",
    priority: t.priority,
    done: t.done,
    doneAt: t.done_at ?? null,
    dueAt: t.due_at ?? null,
  };
}
