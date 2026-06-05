import type { Filter } from "../../../patterns/ListPattern";

export const RECEIVABLES_FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  // 내 채권 — 운영자(row.owner)가 현재 로그인 운영자(currentUserName)인 행만
  { value: "mine", label: "내 채권" },
  { value: "active", label: "미수" },
  { value: "approved", label: "수금" },
];

// receivables는 Excel 외부 데이터 — '+ 새 행' 미지원 (readonly). blank factory 없음.
