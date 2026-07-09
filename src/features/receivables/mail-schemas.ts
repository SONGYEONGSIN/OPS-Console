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
  invoiceDate: z.string().min(1), // Excel 표시 텍스트 그대로 (YYYY-MM-DD 등)
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

/** 발신 운영자 (담당 운영자 본인 메일박스에서 발송) */
export const senderSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});
export type Sender = z.infer<typeof senderSchema>;

/**
 * (담당 운영자, 학교담당자) 단위 그룹.
 * 한 학교담당자에 여러 운영자의 청구건이 걸리면 운영자별로 분리되어 N통 발송된다.
 */
export const operatorReminderGroupSchema = reminderGroupSchema.extend({
  sender: senderSchema,
});
export type OperatorReminderGroup = z.infer<typeof operatorReminderGroupSchema>;

/** 제외 사유 (UI 노출용) */
export const excludedReasonSchema = z.object({
  rowIndex: z.number().int().min(0),
  customerName: z.string().optional(),
  /** 이 행의 학교담당자 이메일 — 수신자별로 제외 사유를 필터링할 때 사용 */
  recipientEmail: z.string().optional(),
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

/**
 * Server Action 입력.
 *
 * 발송 그룹·발신 운영자는 클라이언트가 보내지 않는다 — 서버가 시트를 재조회해
 * 재도출한다. 클라이언트가 발신자를 지정할 수 있으면 임의 운영자 메일박스로
 * 발송하는 사칭 통로가 열리기 때문. 여기서는 '어느 수신자의 어느 범위'만 받는다.
 */
export const sendReminderInputSchema = z
  .object({
    recipientEmail: z.string().email(),
    /** single = 현재 행의 거래처 1건만 / bundle = 해당 학교담당자의 전체 청구건 */
    scope: z.enum(["single", "bundle"]),
    /** scope='single' 일 때 대상 행을 특정 — 필수 */
    customerName: z.string().min(1).optional(),
    dryRun: z.boolean(),
  })
  .strip()
  .superRefine((v, ctx) => {
    if (v.scope === "single" && !v.customerName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customerName"],
        message: "scope='single' 이면 customerName 이 필요합니다.",
      });
    }
  });
export type SendReminderInput = z.infer<typeof sendReminderInputSchema>;

/** 그룹별 발송 결과 */
export const sendReminderItemResultSchema = z.object({
  recipientEmail: z.string().email(),
  /** 발신 운영자 메일박스 — 같은 수신자라도 운영자별로 결과가 나뉜다 */
  senderEmail: z.string().email(),
  status: z.enum(["sent", "failed", "dry_run"]),
  graphMessageId: z.string().optional(),
  errorMessage: z.string().optional(),
});
export type SendReminderItemResult = z.infer<
  typeof sendReminderItemResultSchema
>;

/** Server Action 결과 */
export const sendReminderResultSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    sentCount: z.number().int().min(0),
    failedCount: z.number().int().min(0),
    dryRunCount: z.number().int().min(0),
    /** 운영자 이메일 매핑 실패로 발송에서 제외된 청구건 수 */
    blockedCount: z.number().int().min(0),
    results: z.array(sendReminderItemResultSchema),
  }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
  }),
]);
export type SendReminderResult = z.infer<typeof sendReminderResultSchema>;
