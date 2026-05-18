import { z } from "zod";

export const STATUS_VALUES = ["draft", "ready", "published"] as const;
export const statusSchema = z.enum(STATUS_VALUES);
export type HandoverStatus = z.infer<typeof statusSchema>;

const mdField = z.string().max(10000).nullable().optional();

/**
 * DB row 형상. RLS authenticated 모두 read.
 */
export const handoverRecordRowSchema = z.object({
  id: z.string().uuid(),
  service_id: z.string().uuid(),
  contract_info_md: mdField,
  contract_data_md: mdField,
  work_basic_md: mdField,
  work_generator_md: mdField,
  work_site_md: mdField,
  work_output_md: mdField,
  work_rate_md: mdField,
  work_file_md: mdField,
  work_etc_md: mdField,
  payment_fee_md: mdField,
  payment_invoice_md: mdField,
  school_contact_md: mdField,
  docs_md: mdField,
  notes_md: mdField,
  author_email: z.string().email(),
  author_name: z.string().min(1),
  status: statusSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export type HandoverRecordRow = z.infer<typeof handoverRecordRowSchema>;

/**
 * upsert 입력. service_id로 매칭 (unique constraint).
 * 14 필드는 모두 optional/null — 부분 갱신 시 빈 필드는 그대로 null 저장.
 * author_*, status, updated_at은 server action에서 자동 채움.
 */
export const handoverRecordUpsertSchema = z.object({
  service_id: z.string().uuid(),
  contract_info_md: mdField,
  contract_data_md: mdField,
  work_basic_md: mdField,
  work_generator_md: mdField,
  work_site_md: mdField,
  work_output_md: mdField,
  work_rate_md: mdField,
  work_file_md: mdField,
  work_etc_md: mdField,
  payment_fee_md: mdField,
  payment_invoice_md: mdField,
  school_contact_md: mdField,
  docs_md: mdField,
  notes_md: mdField,
});

export type HandoverRecordUpsert = z.infer<typeof handoverRecordUpsertSchema>;
