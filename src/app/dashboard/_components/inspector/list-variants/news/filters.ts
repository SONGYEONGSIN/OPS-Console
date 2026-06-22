import type { Filter } from "../../../patterns/ListPattern";

// news: 신규 생성 흐름 없음 (news-collect 잡이 적재). 키워드 chip으로 필터.
// Filter union에 키워드 값이 없으면 빈 배열로 두고 ScopeChips 미사용 — 실 Filter union
// 확장이 필요하면 ListPattern Filter 타입에 키워드 값을 먼저 추가한다(별도 결정).
export const NEWS_FILTERS: { value: Filter; label: string }[] = [];
