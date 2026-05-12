import type { ListRow, Filter } from "../../../patterns/ListPattern";

export const MY_TODO_FILTERS: { value: Filter; label: string }[] = [
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
 * my-todo variant의 filter 적용 — done / undone / today / due-soon / 기타(status).
 * filter === "all"은 호출자(filterRows)가 먼저 가드.
 */
export function applyMyTodoFilter(rows: ListRow[], filter: Filter): ListRow[] {
  if (filter === "done") return rows.filter((r) => r.done === true);
  if (filter === "undone") return rows.filter((r) => !r.done);
  if (filter === "today") {
    const todayKey = todayKstKey();
    return rows.filter((r) => r.dueAt && kstDateKey(r.dueAt) === todayKey);
  }
  if (filter === "due-soon") {
    // 미완 + 마감일 3일 이내
    const limit = Date.now() + 3 * 24 * 60 * 60 * 1000;
    return rows.filter(
      (r) => !r.done && r.dueAt && new Date(r.dueAt).getTime() <= limit,
    );
  }
  return rows;
}

export function blankMyTodoRow(): ListRow {
  return {
    id: "",
    name: "",
    status: "active",
    owner: "",
    priority: "medium",
    done: false,
    dueAt: null,
  };
}
