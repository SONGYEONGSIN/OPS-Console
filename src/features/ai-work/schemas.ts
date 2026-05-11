import { z } from "zod";

export const aiToolSchema = z.enum([
  "claude",
  "chatgpt",
  "gemini",
  "cursor",
  "copilot",
  "notion_ai",
  "etc",
]);
export type AiTool = z.infer<typeof aiToolSchema>;

export const categorySchema = z.enum([
  "code",
  "doc",
  "analysis",
  "design",
  "translation",
  "meeting",
  "automation",
  "etc",
]);
export type AiWorkCategory = z.infer<typeof categorySchema>;

export const aiWorkRowSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(120),
  work_date: z.string(),
  ai_tool: aiToolSchema,
  category: categorySchema,
  summary_md: z.string().min(1),
  output_url: z.string().nullable().optional(),
  reuse_prompt: z.string().nullable().optional(),
  saved_hours: z.number().nonnegative().nullable().optional(),
  tags: z.array(z.string()),
  author_email: z.string().email(),
  author_id: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type AiWorkRow = z.infer<typeof aiWorkRowSchema>;

export const aiWorkCreateSchema = z.object({
  title: z.string().min(1).max(120),
  work_date: z.string().min(1),
  ai_tool: aiToolSchema,
  category: categorySchema,
  summary_md: z.string().min(1),
  output_url: z.string().url().nullable().optional(),
  reuse_prompt: z.string().nullable().optional(),
  saved_hours: z.number().nonnegative().nullable().optional(),
  tags: z.array(z.string()).default([]),
});

export type AiWorkCreate = z.infer<typeof aiWorkCreateSchema>;

export const aiWorkUpdateSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  work_date: z.string().min(1).optional(),
  ai_tool: aiToolSchema.optional(),
  category: categorySchema.optional(),
  summary_md: z.string().min(1).optional(),
  output_url: z.string().url().nullable().optional(),
  reuse_prompt: z.string().nullable().optional(),
  saved_hours: z.number().nonnegative().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export type AiWorkUpdate = z.infer<typeof aiWorkUpdateSchema>;
