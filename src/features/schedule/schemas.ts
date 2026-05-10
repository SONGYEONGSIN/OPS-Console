import { z } from "zod";

export const scheduleTypeSchema = z.enum([
  "shift",
  "event",
  "leave",
  "training",
]);
export type ScheduleType = z.infer<typeof scheduleTypeSchema>;

const isoDateTime = z.string().min(1);

const compareEndAfterStart = (
  data: { start_at?: string; end_at?: string | null },
  ctx: z.RefinementCtx,
) => {
  if (!data.start_at || !data.end_at) return;
  if (new Date(data.end_at).getTime() < new Date(data.start_at).getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["end_at"],
      message: "end_at 은 start_at 이후이거나 같아야 합니다",
    });
  }
};

export const scheduleEventRowSchema = z.object({
  id: z.string().uuid(),
  type: scheduleTypeSchema,
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  start_at: isoDateTime,
  end_at: isoDateTime.nullable().optional(),
  all_day: z.boolean(),
  assignee_email: z.string().email().nullable().optional(),
  created_by_email: z.string().email(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ScheduleEventRow = z.infer<typeof scheduleEventRowSchema>;

export const scheduleEventCreateSchema = z
  .object({
    type: scheduleTypeSchema,
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    start_at: isoDateTime,
    end_at: isoDateTime.nullable().optional(),
    all_day: z.boolean().default(false),
    assignee_email: z.string().email().nullable().optional(),
    created_by_email: z.string().email(),
  })
  .superRefine(compareEndAfterStart);

export type ScheduleEventCreate = z.infer<typeof scheduleEventCreateSchema>;

export const scheduleEventUpdateSchema = z
  .object({
    type: scheduleTypeSchema.optional(),
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    start_at: isoDateTime.optional(),
    end_at: isoDateTime.nullable().optional(),
    all_day: z.boolean().optional(),
    assignee_email: z.string().email().nullable().optional(),
  })
  .superRefine(compareEndAfterStart);

export type ScheduleEventUpdate = z.infer<typeof scheduleEventUpdateSchema>;
