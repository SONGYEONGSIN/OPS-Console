import { z } from "zod";

export const PROGRESS_STATUS_VALUES = [
  "in_progress",
  "completed",
  "cancelled",
] as const;
export const progressStatusSchema = z.enum(PROGRESS_STATUS_VALUES);
export type HandoverProgressStatus = z.infer<typeof progressStatusSchema>;

/** DB row 형상 */
export const handoverProgressRowSchema = z.object({
  id: z.string().uuid(),
  service_id: z.string().uuid(),
  from_email: z.string().email(),
  from_name: z.string().min(1),
  to_email: z.string().email(),
  to_name: z.string().min(1),
  status: progressStatusSchema,
  notes: z.string().nullable().optional(),
  confirmed_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type HandoverProgressRow = z.infer<typeof handoverProgressRowSchema>;

/** create 입력 — wizard step4 confirm 시. from_*은 server action에서 채움 */
export const handoverProgressCreateSchema = z.object({
  service_id: z.string().uuid(),
  to_email: z.string().email(),
  to_name: z.string().min(1),
  notes: z.string().max(2000).nullable().optional(),
});
export type HandoverProgressCreate = z.infer<
  typeof handoverProgressCreateSchema
>;
