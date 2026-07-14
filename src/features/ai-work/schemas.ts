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
  "productivity",
  "devtool",
  "etc",
]);
export type AiWorkCategory = z.infer<typeof categorySchema>;

/** work_end_date >= work_start_date 검증. 양쪽 모두 'YYYY-MM-DD' 가정 (ISO 비교로 충분). */
const dateRangeRefine = <
  T extends { work_start_date: string; work_end_date: string },
>(
  obj: T,
  ctx: z.RefinementCtx,
) => {
  if (obj.work_end_date < obj.work_start_date) {
    ctx.addIssue({
      code: "custom",
      message: "작업 종료일은 시작일 이상이어야 합니다.",
      path: ["work_end_date"],
    });
  }
};

export const aiWorkRowSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(1).max(120),
    work_start_date: z.string().min(1),
    work_end_date: z.string().min(1),
    ai_tool: aiToolSchema,
    category: categorySchema,
    summary_md: z.string().min(1),
    feature_desc: z.string().nullable().optional(),
    output_url: z.string().nullable().optional(),
    reuse_prompt: z.string().nullable().optional(),
    saved_hours: z.number().nonnegative().nullable().optional(),
    tags: z.array(z.string()),
    author_email: z.string().email(),
    author_id: z.string().uuid().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .superRefine(dateRangeRefine);

export type AiWorkRow = z.infer<typeof aiWorkRowSchema>;

export const aiWorkCreateSchema = z
  .object({
    title: z.string().min(1).max(120),
    work_start_date: z.string().min(1),
    work_end_date: z.string().min(1),
    ai_tool: aiToolSchema,
    category: categorySchema,
    summary_md: z.string().min(1),
    feature_desc: z.string().nullable().optional(),
    output_url: z.string().url().nullable().optional(),
    reuse_prompt: z.string().nullable().optional(),
    saved_hours: z.number().nonnegative().nullable().optional(),
    tags: z.array(z.string()).default([]),
  })
  .superRefine(dateRangeRefine);

export type AiWorkCreate = z.infer<typeof aiWorkCreateSchema>;

export const aiWorkUpdateSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    work_start_date: z.string().min(1).optional(),
    work_end_date: z.string().min(1).optional(),
    ai_tool: aiToolSchema.optional(),
    category: categorySchema.optional(),
    summary_md: z.string().min(1).optional(),
    feature_desc: z.string().nullable().optional(),
    output_url: z.string().url().nullable().optional(),
    reuse_prompt: z.string().nullable().optional(),
    saved_hours: z.number().nonnegative().nullable().optional(),
    tags: z.array(z.string()).optional(),
  })
  .superRefine((obj, ctx) => {
    // 둘 다 있을 때만 비교 (부분 업데이트 허용)
    if (obj.work_start_date && obj.work_end_date) {
      if (obj.work_end_date < obj.work_start_date) {
        ctx.addIssue({
          code: "custom",
          message: "작업 종료일은 시작일 이상이어야 합니다.",
          path: ["work_end_date"],
        });
      }
    }
  });

export type AiWorkUpdate = z.infer<typeof aiWorkUpdateSchema>;
