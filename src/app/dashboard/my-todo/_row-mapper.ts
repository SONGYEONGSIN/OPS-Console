import type { ListRow } from "../_components/patterns/ListPattern";
import type { TodoRow } from "@/features/todos/schemas";

export function todoToListRow(t: TodoRow): ListRow {
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
    category: t.category ?? undefined,
    progress: t.progress ?? 0,
    todoStatus: t.status ?? "todo",
  };
}
