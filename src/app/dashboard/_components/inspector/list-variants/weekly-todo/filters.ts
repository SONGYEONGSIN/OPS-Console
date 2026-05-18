import type { ListRow, Filter } from "../../../patterns/ListPattern";

export const WEEKLY_TODO_FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "undone", label: "미완료" },
  { value: "done", label: "완료" },
  { value: "today", label: "오늘" },
  { value: "due-soon", label: "마감 임박" },
];

function todayKstKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date(),
  );
}

function kstDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date(iso),
  );
}

/**
 * weekly-todo variant의 filter 적용 — my-todo filter 미러 + 카테고리/상태 확장 여지 보존.
 */
export function applyWeeklyTodoFilter(
  rows: ListRow[],
  filter: Filter,
): ListRow[] {
  if (filter === "done") return rows.filter((r) => r.done === true);
  if (filter === "undone") return rows.filter((r) => !r.done);
  if (filter === "today") {
    const todayKey = todayKstKey();
    return rows.filter((r) => r.dueAt && kstDateKey(r.dueAt) === todayKey);
  }
  if (filter === "due-soon") {
    const limit = Date.now() + 3 * 24 * 60 * 60 * 1000;
    return rows.filter(
      (r) => !r.done && r.dueAt && new Date(r.dueAt).getTime() <= limit,
    );
  }
  return rows;
}

export function blankWeeklyTodoRow(): ListRow {
  return {
    id: "",
    name: "",
    status: "active",
    owner: "",
    priority: "medium",
    done: false,
    dueAt: null,
    category: undefined,
    progress: 0,
    todoStatus: "todo",
  };
}
