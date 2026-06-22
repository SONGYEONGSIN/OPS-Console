import { z } from "zod";

export const newsRowSchema = z.object({
  id: z.string().uuid(),
  link: z.string().min(1),
  title: z.string().min(1),
  source: z.string().nullable().optional(),
  published_at: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  keyword: z.string().nullable().optional(),
  collected_at: z.string(),
});

export type NewsRow = z.infer<typeof newsRowSchema>;
