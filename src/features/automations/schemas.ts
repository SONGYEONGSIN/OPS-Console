import { z } from "zod";

export const runAutomationInputSchema = z.object({
  jobId: z.string().min(1),
  force: z.boolean(),
});

export type RunAutomationInput = z.infer<typeof runAutomationInputSchema>;

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
