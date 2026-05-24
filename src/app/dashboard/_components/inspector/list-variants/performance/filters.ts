import type { ListRow, Filter } from "../../../patterns/ListPattern";

/** performance 도메인 — chip 필터는 ScopeChips(전체 / 내가 평가 / 내가 받는 평가)로
 *  inline 처리. 카테고리 chip은 비활성. */
export const PERFORMANCE_FILTERS: { value: Filter; label: string }[] = [];

/** 신규 사이클 생성용 blank row (admin이 + 새 사이클 클릭 시). */
export function blankPerformanceRow(): ListRow {
  return {
    id: "",
    name: "",
    status: "active",
    owner: "",
    performanceCurrentStep: 1,
  };
}
