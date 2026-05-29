import { z } from "zod";

export const postDomainSchema = z.enum(["feedback", "notice"]);
export type PostDomain = z.infer<typeof postDomainSchema>;

export const postStatusSchema = z.enum([
  "urgent",
  "active",
  "review",
  "approved",
]);
export type PostStatus = z.infer<typeof postStatusSchema>;

export const postRowSchema = z.object({
  id: z.string().uuid(),
  domain: postDomainSchema,
  slug: z.string().nullable().optional(),
  title: z.string().min(1),
  body: z.string().nullable().optional(),
  author_email: z.string().email(),
  author_id: z.string().uuid().nullable().optional(),
  owner_label: z.string().nullable().optional(),
  status: postStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export type PostRow = z.infer<typeof postRowSchema>;

export const postCreateSchema = z.object({
  domain: postDomainSchema,
  title: z.string().min(1, "제목을 입력해주세요"),
  body: z.string().optional(),
  author_email: z.string().email(),
  author_id: z.string().uuid().nullable().optional(),
  owner_label: z.string().nullable().optional(),
  status: postStatusSchema.default("urgent"),
  slug: z.string().optional(),
});

export type PostCreate = z.infer<typeof postCreateSchema>;

export const postUpdateSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요").optional(),
  body: z.string().nullable().optional(),
  owner_label: z.string().nullable().optional(),
  status: postStatusSchema.optional(),
});

export type PostUpdate = z.infer<typeof postUpdateSchema>;
