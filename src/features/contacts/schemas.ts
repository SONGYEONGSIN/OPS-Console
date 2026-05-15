import { z } from "zod";

/**
 * contacts 도메인 schemas.
 *
 * 1차 PR(#999 plan 채택)에서는 customer_active / job_role / management_grade /
 * relationship_grade / department_name 전부 `z.string()` text 자유 입력.
 * 실 데이터 분포 분석 후 follow-up에서 enum check 도입 (services 패턴 동일).
 */
export const contactRowSchema = z.object({
  id: z.string().uuid(),
  customer_active: z.string().min(1), // 재직 / 타부서 이동
  customer_name: z.string().min(1),
  job_title: z.string().nullable(),
  university_name: z.string().min(1),
  department_name: z.string().nullable(),
  job_role: z.string().nullable(),
  management_grade: z.string().nullable(),
  relationship_grade: z.string().nullable(),
  contact_phone: z.string().nullable(),
  contact_ext: z.string().nullable(),
  contact_email: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ContactRow = z.infer<typeof contactRowSchema>;

export const contactCreateSchema = z.object({
  customer_active: z.string().min(1).default("재직"),
  customer_name: z.string().min(1),
  job_title: z.string().nullable(),
  university_name: z.string().min(1),
  department_name: z.string().nullable(),
  job_role: z.string().nullable(),
  management_grade: z.string().nullable(),
  relationship_grade: z.string().nullable(),
  contact_phone: z.string().nullable(),
  contact_ext: z.string().nullable(),
  contact_email: z.string().nullable(),
});

export type ContactCreate = z.infer<typeof contactCreateSchema>;

export const contactUpdateSchema = z.object({
  customer_active: z.string().min(1).optional(),
  customer_name: z.string().min(1).optional(),
  job_title: z.string().nullable().optional(),
  university_name: z.string().min(1).optional(),
  department_name: z.string().nullable().optional(),
  job_role: z.string().nullable().optional(),
  management_grade: z.string().nullable().optional(),
  relationship_grade: z.string().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  contact_ext: z.string().nullable().optional(),
  contact_email: z.string().nullable().optional(),
});

export type ContactUpdate = z.infer<typeof contactUpdateSchema>;
