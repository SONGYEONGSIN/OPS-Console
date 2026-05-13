import { z } from "zod";

/**
 * services 도메인 schemas.
 *
 * 1차 PR(#92 plan 채택)에서는 application_type / region / university_type /
 * category / source를 `z.string()` 자유 텍스트로 둔다. 실 데이터(2511행, gitignored)
 * 분석이 완료된 후 follow-up PR에서 zod enum + DB check 제약을 도입한다.
 */
export const servicesRowSchema = z.object({
  id: z.string().uuid(),
  service_id: z.number().int(),
  application_type: z.string().min(1),
  region: z.string().min(1),
  university_name: z.string().min(1),
  service_name: z.string().min(1),
  university_type: z.string().min(1),
  category: z.string().min(1),
  operator_email: z.string().email().nullable(),
  operator_name: z.string().nullable(),
  developer_email: z.string().email().nullable(),
  developer_name: z.string().nullable(),
  write_start_at: z.string().nullable(),
  write_end_at: z.string().nullable(),
  pay_start_at: z.string().nullable(),
  pay_end_at: z.string().nullable(),
  solo: z.boolean(),
  source: z.string().min(1),
  imported_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ServicesRow = z.infer<typeof servicesRowSchema>;

export const servicesCreateSchema = z.object({
  service_id: z.number().int(),
  application_type: z.string().min(1),
  region: z.string().min(1),
  university_name: z.string().min(1),
  service_name: z.string().min(1),
  university_type: z.string().min(1),
  category: z.string().min(1),
  operator_email: z.string().email().nullable(),
  operator_name: z.string().nullable(),
  developer_email: z.string().email().nullable(),
  developer_name: z.string().nullable(),
  write_start_at: z.string().nullable(),
  write_end_at: z.string().nullable(),
  pay_start_at: z.string().nullable(),
  pay_end_at: z.string().nullable(),
  solo: z.boolean().default(false),
  source: z.string().min(1).default("folio_create"),
});

export type ServicesCreate = z.infer<typeof servicesCreateSchema>;

export const servicesUpdateSchema = z.object({
  service_id: z.number().int().optional(),
  application_type: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  university_name: z.string().min(1).optional(),
  service_name: z.string().min(1).optional(),
  university_type: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  operator_email: z.string().email().nullable().optional(),
  operator_name: z.string().nullable().optional(),
  developer_email: z.string().email().nullable().optional(),
  developer_name: z.string().nullable().optional(),
  write_start_at: z.string().nullable().optional(),
  write_end_at: z.string().nullable().optional(),
  pay_start_at: z.string().nullable().optional(),
  pay_end_at: z.string().nullable().optional(),
  solo: z.boolean().optional(),
  source: z.string().min(1).optional(),
});

export type ServicesUpdate = z.infer<typeof servicesUpdateSchema>;
