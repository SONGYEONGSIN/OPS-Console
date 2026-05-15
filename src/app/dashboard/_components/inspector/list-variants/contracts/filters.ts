import type { Filter } from "../../../patterns/ListPattern";

// contracts variant의 status 기반 filter chip은 사용 안 함.
// "전체 / 내 계약" mutual exclusive 토글은 ScopeChips(URL 기반)가 ListPattern의
// `inlineFilters` prop으로 주입되어 filter chip 영역을 단독 책임 (services 동일 패턴).
export const CONTRACTS_FILTERS: { value: Filter; label: string }[] = [];
