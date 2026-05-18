import type { ListRow } from "../../../patterns/ListPattern";

// ai-work는 별도 filter set 없음 — default(status 기준) 상속.

export function blankAiWorkRow(opts?: { currentUserName?: string }): ListRow {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: "",
    name: "",
    status: "active",
    owner: opts?.currentUserName ?? "",
    workStartDate: today,
    workEndDate: today,
    aiTool: "",
    category: "",
    summary: "",
    tags: [],
  };
}
