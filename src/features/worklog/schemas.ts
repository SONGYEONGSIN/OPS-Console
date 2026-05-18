import { z } from "zod";

export const WORKLOG_LEVELS = ["INFO", "WARN", "ERROR", "DEBUG"] as const;
export const worklogLevelSchema = z.enum(WORKLOG_LEVELS);
export type WorklogLevel = z.infer<typeof worklogLevelSchema>;

export const worklogRowSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  level: worklogLevelSchema,
  user_email: z.string().nullable().optional(),
  user_name: z.string().nullable().optional(),
  domain: z.string().min(1),
  action: z.string().min(1),
  target_type: z.string().nullable().optional(),
  target_id: z.string().nullable().optional(),
  target_name: z.string().nullable().optional(),
  msg: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type WorklogRow = z.infer<typeof worklogRowSchema>;

export const worklogInsertSchema = z.object({
  level: worklogLevelSchema.optional(),
  domain: z.string().min(1),
  action: z.string().min(1),
  target_type: z.string().nullable().optional(),
  target_id: z.string().nullable().optional(),
  target_name: z.string().nullable().optional(),
  msg: z.string().min(1).max(500),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type WorklogInsert = z.infer<typeof worklogInsertSchema>;
