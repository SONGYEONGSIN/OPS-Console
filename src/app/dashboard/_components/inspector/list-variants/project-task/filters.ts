import type { ListRow, Filter } from "../../../patterns/ListPattern";

export const PROJECT_TASK_FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "undone", label: "진행중" },
  { value: "done", label: "완료" },
  { value: "due-soon", label: "마감 임박" },
];

function todayKstKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date(),
  );
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const from = new Date(`${fromYmd}T12:00:00Z`).getTime();
  const to = new Date(`${toYmd}T12:00:00Z`).getTime();
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

export function applyProjectTaskFilter(
  rows: ListRow[],
  filter: Filter,
): ListRow[] {
  if (filter === "done") return rows.filter((r) => (r.progress ?? 0) >= 100);
  if (filter === "undone")
    return rows.filter((r) => (r.progress ?? 0) < 100);
  if (filter === "due-soon") {
    const today = todayKstKey();
    return rows.filter(
      (r) =>
        (r.progress ?? 0) < 100 &&
        r.endDateYmd != null &&
        daysBetween(today, r.endDateYmd) >= 0 &&
        daysBetween(today, r.endDateYmd) <= 3,
    );
  }
  return rows;
}

export function blankProjectTaskRow(projectId?: string): ListRow {
  return {
    id: "",
    name: "",
    status: "active",
    owner: "",
    priority: "medium",
    progress: 0,
    todoStatus: "todo",
    startDateYmd: null,
    endDateYmd: null,
    projectId,
  };
}
