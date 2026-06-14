import { z } from "zod";

/**
 * 인사이트 영상 수집 대상 채널 (YouTube channelId + 표시명).
 * 각 채널의 uploads 플레이리스트에서 최근 업로드를 수집한다 (국내/해외 무관).
 * channelId는 YouTube Data API search(type=channel)로 1회 resolve해 고정.
 */
export const INSIGHT_CHANNELS = [
  { id: "UC-2RKtsC_66v7xqRQOGLohw", name: "바이브랩스" },
  { id: "UC4PwAtNhPsuBYdavDJb4F0g", name: "편집자P" },
  { id: "UCmWgoMokR8Z9GKDjz28lJYw", name: "호두의 AI 분석실" },
  { id: "UCdLZ0MsYS4hmqFgOYCB6C9w", name: "CONNECT AI LAB" },
  { id: "UC6xro-nRXlpa4A5UoeFKUDA", name: "바이브마피아 | AI Native 엔지니어" },
  { id: "UC0WxGJnTB_04ViIrxPvFRmg", name: "메이커 에반 | Maker Evan" },
  { id: "UCxZ2AlaT0hOmxzZVbF_j_Sw", name: "코드팩토리" },
  { id: "UCfBvs0ZJdTA43NQrnI9imGA", name: "코딩알려주는누나" },
  { id: "UC1_ZZYZsHh2_DzCXN4VGVcQ", name: "개발동생" },
  { id: "UCrniteV94CiBEFsybVYt3uQ", name: "데키랩" },
  { id: "UCBlTB7GyNQLqZMDRFEZ_cSg", name: "신영선의 AI탐구" },
  { id: "UChu25pJgVZB3p0dVEgmU0PQ", name: "메타코드M" },
  { id: "UCyVhY9BXSryuOvO692FSS_Q", name: "일하는 ai" },
  { id: "UCxj3eVTAv9KLdrowXcuCFDQ", name: "빌더 조쉬 Builder Josh" },
  { id: "UCZ30aWiMw5C8mGcESlAGQbA", name: "짐코딩" },
  { id: "UCOXRjenlq9PmlTqd_JhAbMQ", name: "Eric Tech" },
  { id: "UCd7KZCoLd9JK_wNuLHQBPOA", name: "피튜브" },
  { id: "UC2ODfJSf8L4PeCw4ebTECJQ", name: "AgentOS" },
  { id: "UC1xqnOS-gsu2tSGTn_FDnFQ", name: "코딩 못하는 문과 개발자" },
  { id: "UCk_xkR8ORNwtMkaffvYArGA", name: "디자인하는AI" },
] as const;

export type InsightChannel = (typeof INSIGHT_CHANNELS)[number];

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
