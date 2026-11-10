import { z } from "zod";
import { ratioAuditFiltersSchema } from "@/features/ratio-audit/run-filters";
import { RATIO_AUDIT_JOB_IDS } from "@/features/ratio-audit/run-message";

export const runAutomationInputSchema = z.object({
  jobId: z.string().min(1),
  force: z.boolean(),
});

export type RunAutomationInput = z.infer<typeof runAutomationInputSchema>;

// 경쟁률 점검 조건 실행 — 조건 창을 쓰는 두 잡만 받는다
export const runRatioAuditInputSchema = ratioAuditFiltersSchema.extend({
  jobId: z.enum(RATIO_AUDIT_JOB_IDS, {
    error: "조건 창을 쓰는 자동화가 아닙니다.",
  }),
  force: z.boolean(),
});

export const setAutomationEnabledInputSchema = z.object({
  jobId: z.string().min(1),
  enabled: z.boolean(),
});

export type SetAutomationEnabledInput = z.infer<
  typeof setAutomationEnabledInputSchema
>;

export const publishBriefingDraftInputSchema = z.object({
  draftId: z.string().uuid(),
});

export type PublishBriefingDraftInput = z.infer<
  typeof publishBriefingDraftInputSchema
>;
