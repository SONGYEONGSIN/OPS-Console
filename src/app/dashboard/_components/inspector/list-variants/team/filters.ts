import type { ListRow, Filter } from "../../../patterns/ListPattern";

export const TEAM_FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "active", label: "활성" },
  { value: "inactive", label: "점검중" },
  { value: "suspended", label: "정지" },
  { value: "deleted", label: "삭제" },
];

export function blankTeamRow(): ListRow {
  return {
    id: "",
    name: "",
    status: "active",
    owner: "운영1팀",
    meta: "매니저",
    permission: "member",
  };
}
