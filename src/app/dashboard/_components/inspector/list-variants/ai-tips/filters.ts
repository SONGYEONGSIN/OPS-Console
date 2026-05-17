import type { ListRow } from "../../../patterns/ListPattern";

// ai-tips는 별도 filter set 없음 — default(status 기준) 상속.

export function blankAiTipRow(opts?: { currentUserName?: string }): ListRow {
  return {
    id: "",
    name: "",
    status: "active",
    owner: opts?.currentUserName ?? "",
    aiTool: "",
    category: "",
    summary: "",
    reusePrompt: "",
    tags: [],
  };
}
