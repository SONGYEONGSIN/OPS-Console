import type { Filter } from "../../../patterns/ListPattern";

export const RECEIVABLES_FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "active", label: "미수" },
  { value: "approved", label: "수금" },
];

// receivables는 Excel 외부 데이터 — '+ 새 행' 미지원 (readonly). blank factory 없음.
