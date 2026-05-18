import type { ListRow, Filter } from "../../../patterns/ListPattern";

export const PROJECT_TASK_FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "undone", label: "진행중" },
  { value: "done", label: "완료" },
];

export function applyProjectTaskFilter(
  rows: ListRow[],
  filter: Filter,
): ListRow[] {
  if (filter === "done") return rows.filter((r) => r.todoStatus === "done");
  if (filter === "undone")
    return rows.filter((r) => r.todoStatus !== "done");
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
