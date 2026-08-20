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
  // 공지 시각(ISO) — 이 시각 이후 첫 실행에 Teams 1회 공유. null = 작성 즉시. notice 전용.
  announce_at: z.string().nullable().optional(),
  // Teams 공유 완료 시각(ISO). null = 미발송. notice 전용.
  notice_shared_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type PostRow = z.infer<typeof postRowSchema>;

// 공지일 입력 — YYYY-MM-DD 또는 null(즉시).
/**
 * 공지 시각 — 화면의 datetime-local 이 'YYYY-MM-DDTHH:mm' 을 준다.
 *
 * 초·시간대가 없는 값이라 서버가 KST 로 읽어 ISO 로 바꾼다. 브라우저에 맡기면
 * 다른 시간대에서 연 창이 다른 시각으로 저장된다.
 */
const announceAtField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "올바른 날짜·시각이 아닙니다.")
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
  announce_at: announceAtField,
});

export type PostCreate = z.infer<typeof postCreateSchema>;

export const postUpdateSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요").optional(),
  body: z.string().nullable().optional(),
  owner_label: z.string().nullable().optional(),
  status: postStatusSchema.optional(),
  announce_at: announceAtField,
});

export type PostUpdate = z.infer<typeof postUpdateSchema>;
