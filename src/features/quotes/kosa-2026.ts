/** KOSA SW기술자 노임단가 2026 적용(일평균임금, 원). 출처: 한국SW산업협회 2025.12.19. */
export const KOSA_2026 = [
  { key: "planner", name: "IT기획자", daily: 578206 },
  { key: "consultant", name: "IT컨설턴트", daily: 522340 },
  { key: "analyst", name: "업무분석가", daily: 475154 },
  { key: "data-analyst", name: "데이터분석가", daily: 414600 },
  { key: "pm", name: "IT PM", daily: 492039 },
  { key: "architect", name: "IT아키텍트", daily: 541621 },
  { key: "uiux-plan", name: "UI/UX기획·개발자", daily: 336666 },
  { key: "uiux-design", name: "UI/UX디자이너", daily: 251671 },
  { key: "app-dev", name: "응용SW개발자", daily: 378250 },
  { key: "sys-dev", name: "시스템SW개발자", daily: 284888 },
  { key: "operator", name: "정보시스템운용자", daily: 519469 },
  { key: "support", name: "IT지원기술자", daily: 252196 },
  { key: "marketer", name: "IT마케터", daily: 575293 },
  { key: "qa", name: "IT품질관리자", daily: 538638 },
  { key: "tester", name: "IT테스터", daily: 197714 },
  { key: "auditor", name: "IT감리", daily: 572934 },
  { key: "security", name: "정보보안전문가", daily: 507887 },
] as const;
export type KosaGradeKey = (typeof KOSA_2026)[number]["key"];

/** 등급 key → 일평균임금. 미상 → 0. */
export function kosaDaily(key: string): number {
  return KOSA_2026.find((g) => g.key === key)?.daily ?? 0;
}
