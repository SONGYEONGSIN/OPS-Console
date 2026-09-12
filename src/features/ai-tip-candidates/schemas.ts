import { z } from "zod";

export const CANDIDATE_STATUSES = ["pending", "promoted", "hidden"] as const;

export const candidateStatusSchema = z.enum(CANDIDATE_STATUSES);
export type CandidateStatus = z.infer<typeof candidateStatusSchema>;

/**
 * 수집기가 보내는 후보 1건.
 * draft_*는 전부 optional — claude 초안 생성이 실패해도 리포 정보만으로 후보를 남긴다.
 */
export const aiTipCandidateInsertSchema = z.object({
  repo_full_name: z.string().min(1),
  repo_url: z.string().url(),
  stars: z.number().int().nonnegative().default(0),
  repo_description: z.string().nullable().optional(),
  draft_title: z.string().nullable().optional(),
  draft_summary_md: z.string().nullable().optional(),
  draft_reuse_prompt: z.string().nullable().optional(),
  draft_tags: z.array(z.string()).default([]),
  draft_ai_tool: z.string().nullable().optional(),
  draft_category: z.string().nullable().optional(),
  // 수집기가 보내도 여기에 없으면 zod가 조용히 버린다(z.object는 모르는 키를
  // 에러 없이 떨어뜨린다) — 수집은 "N건 적재 완료"를 찍고 칸만 비어 있게 된다.
  repo_language: z.string().nullable().optional(),
  repo_pushed_at: z.string().nullable().optional(),
});

export type AiTipCandidateInsert = z.infer<typeof aiTipCandidateInsertSchema>;

export const aiTipCandidateBatchSchema = z.object({
  candidates: z.array(aiTipCandidateInsertSchema),
});

export const aiTipCandidateRowSchema = aiTipCandidateInsertSchema.extend({
  id: z.string().uuid(),
  status: candidateStatusSchema,
  collected_at: z.string(),
  // optional이 아니다 — 마이그레이션 전 코드가 배포되면 이 칸이 없는 채로 파싱이
  // 통과해 전건이 조용히 '안 물어봤다'로 보인다. 차라리 크게 실패시킨다.
  repo_synced_at: z.string().nullable(),
});

export type AiTipCandidateRow = z.infer<typeof aiTipCandidateRowSchema>;
