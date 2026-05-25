import type { Filter } from "../../../patterns/ListPattern";

// manual variant의 filter chip은 사용 안 함.
// 카테고리(A~I)는 Table 자체가 그룹 헤더(▼ A — ...)로 분리 — services 패턴 일관.
// 추가 filter UI가 필요하면 ScopeChips 패턴(URL param)으로 별도 컴포넌트 주입.
export const MANUAL_FILTERS: { value: Filter; label: string }[] = [];
