import { z } from "zod";

/**
 * YouTube Data API v3 search.list로 자동 수집되는 키워드 (한국어 우선).
 * 변경 시 GitHub Actions 워크플로의 quota 산정도 함께 검토 (1 키워드 = 100 unit).
 */
export const SEARCH_QUERIES = [
  "바이브코딩",
  "Claude Code",
  "클로드 스킬",
  "AI 환경구축",
  "AI 디자인 활용",
  "AI 개발 환경",
  "AI 활용 업무 적용",
  "AI자동화",
  "OpenAI Codex",
  "AI 코딩 에이전트",
] as const;

export type SearchQuery = (typeof SEARCH_QUERIES)[number];

export const insightVideoRowSchema = z.object({
  id: z.string().uuid(),
  video_id: z.string().min(1),
  title: z.string().min(1),
  channel_title: z.string().min(1),
  thumbnail_url: z.string().min(1),
  published_at: z.string(),
  view_count: z.number().int().nonnegative().nullable().optional(),
  keyword: z.string().min(1),
  description: z.string().nullable().optional(),
  collected_at: z.string(),
});

export type InsightVideoRow = z.infer<typeof insightVideoRowSchema>;
