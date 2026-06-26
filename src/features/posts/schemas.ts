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
  // 공지일(YYYY-MM-DD) — 이 날짜에 Teams 1회 공유. null = 작성 즉시. notice 전용.
  announce_on: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type PostRow = z.infer<typeof postRowSchema>;

// 공지일 입력 — YYYY-MM-DD 또는 null(즉시).
const announceOnField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "올바른 날짜가 아닙니다.")
  .nullable()
  .optional();

export const postCreateSchema = z.object({
  domain: postDomainSchema,
  title: z.string().min(1, "제목을 입력해주세요"),
  body: z.string().optional(),
  author_email: z.string().email(),
  author_id: z.string().uuid().nullable().optional(),
  owner_label: z.string().nullable().optional(),
  status: postStatusSchema.default("urgent"),
  slug: z.string().optional(),
  announce_on: announceOnField,
});

export type PostCreate = z.infer<typeof postCreateSchema>;

export const postUpdateSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요").optional(),
  body: z.string().nullable().optional(),
  owner_label: z.string().nullable().optional(),
  status: postStatusSchema.optional(),
  announce_on: announceOnField,
});

export type PostUpdate = z.infer<typeof postUpdateSchema>;
