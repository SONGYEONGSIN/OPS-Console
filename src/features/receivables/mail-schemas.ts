import { z } from "zod";

/** 학교담당자 (수신자) */
export const recipientSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});
export type Recipient = z.infer<typeof recipientSchema>;

/** 그룹에 묶이는 청구 1건 */
export const reminderItemSchema = z.object({
  customerName: z.string().min(1),
  invoiceDate: z.string().min(1),             // Excel 표시 텍스트 그대로 (YYYY-MM-DD 등)
  description: z.string().default(""),
  daysOverdue: z.number().int().min(0),
  amount: z.number().min(0),
  operatorLabel: z.string().default(""),
  /** Excel 1-based 행 번호 — 발송 후 '메일발송일자' 기록 PATCH 대상 (그룹화에서 채움) */
  excelRow: z.number().int().optional(),
});
export type ReminderItem = z.infer<typeof reminderItemSchema>;

/** 학교담당자별로 묶인 그룹 */
export const reminderGroupSchema = z.object({
  recipient: recipientSchema,
  items: z.array(reminderItemSchema).min(1),
  totalAmount: z.number().min(0),
});
export type ReminderGroup = z.infer<typeof reminderGroupSchema>;

/** 제외 사유 (UI 노출용) */
export const excludedReasonSchema = z.object({
  rowIndex: z.number().int().min(0),
  customerName: z.string().optional(),
  reason: z.enum([
    "below_threshold",
    "invalid_email",
    "missing_email",
    "missing_owner_column",
    "missing_overdue_column",
    "missing_billing_date_column",
    "missing_operator_column",
    "operator_not_found",
    "operator_email_not_mapped",
  ]),
});
export type ExcludedReason = z.infer<typeof excludedReasonSchema>;

/** Server Action 입력 */
export const sendReminderInputSchema = z.object({
  thresholdDays: z.number().int().positive(),
  groups: z.array(reminderGroupSchema).min(1),
  dryRun: z.boolean(),
});
export type SendReminderInput = z.infer<typeof sendReminderInputSchema>;

/** 그룹별 발송 결과 */
export const sendReminderItemResultSchema = z.object({
  recipientEmail: z.string().email(),
  status: z.enum(["sent", "failed", "dry_run"]),
  graphMessageId: z.string().optional(),
  errorMessage: z.string().optional(),
});
export type SendReminderItemResult = z.infer<typeof sendReminderItemResultSchema>;

/** Server Action 결과 */
export const sendReminderResultSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    sentCount: z.number().int().min(0),
    failedCount: z.number().int().min(0),
    dryRunCount: z.number().int().min(0),
    results: z.array(sendReminderItemResultSchema),
  }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
  }),
]);
export type SendReminderResult = z.infer<typeof sendReminderResultSchema>;
