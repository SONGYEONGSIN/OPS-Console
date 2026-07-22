import type { ChecklistItem } from "./schemas";

export type Completion = {
  total: number;
  done: number;
  inProgress: number;
  todo: number;
  na: number;
  pct: number; // done / (total - na), 0~100 정수
};

export function computeCompletion(
  items: Pick<ChecklistItem, "status">[],
): Completion {
  const total = items.length;
  const done = items.filter((i) => i.status === "done").length;
  const inProgress = items.filter((i) => i.status === "in_progress").length;
  const todo = items.filter((i) => i.status === "todo").length;
  const na = items.filter((i) => i.status === "na").length;
  const denom = total - na;
  const pct = denom > 0 ? Math.round((done / denom) * 100) : 0;
  return { total, done, inProgress, todo, na, pct };
}
