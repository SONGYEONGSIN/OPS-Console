import { z } from "zod";

export const STATUS_VALUES = ["draft", "ready", "published"] as const;
export const statusSchema = z.enum(STATUS_VALUES);
export type HandoverStatus = z.infer<typeof statusSchema>;

const mdField = z.string().max(10000).nullable().optional();

/** 계약서류 체크리스트 항목. */
export const HANDOVER_CHECKLIST_MAX = 10;
export const contractChecklistItemSchema = z.object({
  id: z.string(),
  text: z.string().max(200),
  done: z.boolean().default(false),
});
export type ContractChecklistItem = z.infer<typeof contractChecklistItemSchema>;
const checklistField = z
  .array(contractChecklistItemSchema)
  .max(HANDOVER_CHECKLIST_MAX)
  .default([]);

/** 계약정보 — 구조화 폼 (제목/형태/진행/상태/메모). */
export const contractInfoSchema = z.object({
  title: z.string().max(200).default(""),
  type: z.string().max(100).default(""),
  progress: z.string().max(100).default(""),
  status: z.string().max(100).default(""),
  memo: z.string().max(2000).default(""),
});
export type ContractInfo = z.infer<typeof contractInfoSchema>;
const contractInfoField = contractInfoSchema.default({
  title: "",
  type: "",
  progress: "",
  status: "",
  memo: "",
});

/** 컨텍(학교담당자) — 구조화 연락처 항목. */
export const HANDOVER_SCHOOL_CONTACTS_MAX = 30;
export const schoolContactSchema = z.object({
  id: z.string(),
  name: z.string().max(100),
  jobTitle: z.string().max(100).nullable().default(null),
  phone: z.string().max(50).nullable().default(null),
  email: z.string().max(200).nullable().default(null),
});
export type SchoolContact = z.infer<typeof schoolContactSchema>;
const schoolContactsField = z
  .array(schoolContactSchema)
  .max(HANDOVER_SCHOOL_CONTACTS_MAX)
  .default([]);

/**
 * DB row 형상. RLS authenticated 모두 read.
 */
export const handoverRecordRowSchema = z.object({
  id: z.string().uuid(),
  service_id: z.string().uuid(),
  contract_info_md: mdField,
  contract_info: contractInfoField,
  contract_data_md: mdField,
  contract_data_checklist: checklistField,
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
  school_contacts: schoolContactsField,
  docs_md: mdField,
  docs_checklist: checklistField,
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
  contract_info: contractInfoField,
  contract_data_md: mdField,
  contract_data_checklist: checklistField,
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
  school_contacts: schoolContactsField,
  docs_md: mdField,
  docs_checklist: checklistField,
  notes_md: mdField,
});

export type HandoverRecordUpsert = z.infer<typeof handoverRecordUpsertSchema>;
