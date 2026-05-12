import type { ListRow, Filter } from "../../../patterns/ListPattern";

export const DEFAULT_FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "urgent", label: "긴급" },
  { value: "active", label: "활성" },
  { value: "review", label: "점검중" },
  { value: "approved", label: "정상" },
];

export function blankDefaultRow(): ListRow {
  return {
    id: "",
    name: "",
    status: "active",
    owner: "",
  };
}
