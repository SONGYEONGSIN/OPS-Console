import { z } from "zod";
import { aiToolSchema, categorySchema } from "@/features/ai-work/schemas";

export const aiTipRowSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(80),
  ai_tool: aiToolSchema,
  category: categorySchema,
  summary_md: z.string().min(1).max(500),
  reuse_prompt: z.string().min(1),
  tags: z.array(z.string()),
  author_email: z.string().email(),
  author_id: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type AiTipRow = z.infer<typeof aiTipRowSchema>;

export const aiTipCreateSchema = z.object({
  title: z.string().min(1).max(80),
  ai_tool: aiToolSchema,
  category: categorySchema,
  summary_md: z.string().min(1).max(500),
  reuse_prompt: z.string().min(1),
  tags: z.array(z.string()).default([]),
});

export type AiTipCreate = z.infer<typeof aiTipCreateSchema>;

export const aiTipUpdateSchema = z.object({
  title: z.string().min(1).max(80).optional(),
  ai_tool: aiToolSchema.optional(),
  category: categorySchema.optional(),
  summary_md: z.string().min(1).max(500).optional(),
  reuse_prompt: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
});

export type AiTipUpdate = z.infer<typeof aiTipUpdateSchema>;
