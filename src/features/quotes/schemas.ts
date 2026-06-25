import { z } from "zod";
import { quoteTypeSchema } from "./document-schema";

export const QUOTE_STATUS_VALUES = ["draft", "sent", "won", "lost"] as const;
export const quoteStatusSchema = z.enum(QUOTE_STATUS_VALUES);
export type QuoteStatus = z.infer<typeof quoteStatusSchema>;

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: "작성중",
  sent: "발송",
  won: "수주",
  lost: "실주",
};

export const quoteRowSchema = z.object({
  id: z.string().uuid(),
  customer: z.string().min(1),
  quote_date: z.string(), // date (YYYY-MM-DD)
  valid_until: z.string().nullable().optional(),
  amount: z.number().int().nullable().optional(),
  owner_email: z.string().nullable().optional(),
  status: quoteStatusSchema,
  note: z.string().nullable().optional(),
  quote_type: quoteTypeSchema.optional(),
  document: z.unknown().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type QuoteRow = z.infer<typeof quoteRowSchema>;

/** create/update 입력 — id/타임스탬프 제외. */
export const quoteInputSchema = z.object({
  customer: z.string().min(1, "고객/거래처명을 입력하세요."),
  quote_date: z.string().min(1, "견적일자를 입력하세요."),
  valid_until: z.string().nullable().optional(),
  amount: z.number().int().nonnegative().nullable().optional(),
  owner_email: z.string().nullable().optional(),
  status: quoteStatusSchema,
  note: z.string().nullable().optional(),
});
export type QuoteInput = z.infer<typeof quoteInputSchema>;
