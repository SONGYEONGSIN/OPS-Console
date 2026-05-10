import { z } from "zod";

export const cohortStatusSchema = z.enum([
  "planned",
  "in_progress",
  "completed",
]);
export type CohortStatus = z.infer<typeof cohortStatusSchema>;

const dateOnly = z.string().min(1); // 'YYYY-MM-DD' (Postgres date)

export const cohortRowSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  trainee_email: z.string().email(),
  mentor_email: z.string().email().nullable().optional(),
  start_date: dateOnly,
  end_date: dateOnly.nullable().optional(),
  status: cohortStatusSchema,
  notes: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type CohortRow = z.infer<typeof cohortRowSchema>;

export const cohortCreateSchema = z.object({
  title: z.string().min(1),
  trainee_email: z.string().email(),
  mentor_email: z.string().email().nullable().optional(),
  start_date: dateOnly,
  end_date: dateOnly.nullable().optional(),
  status: cohortStatusSchema.default("planned"),
  notes: z.string().nullable().optional(),
});

export type CohortCreate = z.infer<typeof cohortCreateSchema>;

export const cohortUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  trainee_email: z.string().email().optional(),
  mentor_email: z.string().email().nullable().optional(),
  start_date: dateOnly.optional(),
  end_date: dateOnly.nullable().optional(),
  status: cohortStatusSchema.optional(),
  notes: z.string().nullable().optional(),
});

export type CohortUpdate = z.infer<typeof cohortUpdateSchema>;
