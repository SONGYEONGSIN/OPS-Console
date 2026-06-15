/**
 * 인사이트 영상 카테고리 — keyword(수집 출처: 주제/채널명 혼재)를 상위 카테고리로 묶는다.
 * 칩 필터가 keyword(14종+)를 그대로 나열하면 너무 많아지므로, 카테고리 단위로 축소한다.
 * 매핑에 없는 keyword는 "기타"로 떨어진다.
 */
export const INSIGHT_CATEGORIES = [
  "AI 코딩",
  "업무 자동화",
  "AI 디자인",
  "개발 학습",
  "기타",
] as const;

export type InsightCategory = (typeof INSIGHT_CATEGORIES)[number];

const KEYWORD_TO_CATEGORY: Record<string, InsightCategory> = {
  // AI 코딩 — 바이브코딩 / Claude / 코딩 에이전트
  바이브코딩: "AI 코딩",
  "Claude Code": "AI 코딩",
  "클로드 스킬": "AI 코딩",
  "AI 코딩 에이전트": "AI 코딩",
  AgentOS: "AI 코딩",
  // 업무 자동화
  "AI 업무 자동화": "업무 자동화",
  "AI 활용 업무 적용": "업무 자동화",
  AI자동화: "업무 자동화",
  // AI 디자인
  "AI 디자인 활용": "AI 디자인",
  디자인하는AI: "AI 디자인",
  // 개발 학습 — 개발/강의 채널
  "Eric Tech": "개발 학습",
  "빌더 조쉬 Builder Josh": "개발 학습",
  코딩알려주는누나: "개발 학습",
  데키랩: "개발 학습",
};

/** keyword → 카테고리. 미정의 keyword는 "기타". */
export function categoryOf(keyword: string): InsightCategory {
  return KEYWORD_TO_CATEGORY[keyword] ?? "기타";
}
