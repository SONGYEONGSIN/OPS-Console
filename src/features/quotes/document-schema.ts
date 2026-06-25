import { z } from "zod";

export const QUOTE_TYPES = ["dev", "fee", "platform", "labor"] as const;
export const quoteTypeSchema = z.enum(QUOTE_TYPES);
export type QuoteType = z.infer<typeof quoteTypeSchema>;

export const QUOTE_TYPE_LABELS: Record<QuoteType, string> = {
  dev: "시스템 개발비",
  fee: "시스템 수수료",
  platform: "플랫폼 기반",
  labor: "노임단가 기준",
};

export const quoteHeaderSchema = z.object({
  recipient: z.string().default(""),
  quoteName: z.string().default(""),
  quoteNo: z.string().default(""),
  quoteDate: z.string().default(""),
  validUntil: z.string().default(""),
  manager: z.string().default(""),
});
export type QuoteHeader = z.infer<typeof quoteHeaderSchema>;

export const quoteRowSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.null()]),
);
export type QuoteRow = z.infer<typeof quoteRowSchema>;

export const quoteColumnSchema = z.object({
  key: z.string(),
  label: z.string(),
  kind: z.enum(["text", "number", "amount"]).default("text"),
});
export const quoteSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  columns: z.array(quoteColumnSchema),
  rows: z.array(quoteRowSchema),
  subtotal: z.number().default(0),
});
export type QuoteSection = z.infer<typeof quoteSectionSchema>;

export const quoteTotalsSchema = z.object({
  supply: z.number().default(0),
  vat: z.number().default(0),
  total: z.number().default(0),
  vatIncluded: z.boolean().default(false),
});
export type QuoteTotals = z.infer<typeof quoteTotalsSchema>;

export const quoteDocumentSchema = z.object({
  type: quoteTypeSchema,
  header: quoteHeaderSchema,
  sections: z.array(quoteSectionSchema),
  totals: quoteTotalsSchema,
  terms: z.array(z.string()).default([]),
});
export type QuoteDocument = z.infer<typeof quoteDocumentSchema>;

/** 유형별 빈 문서. dev/fee는 4열 단일 섹션. (platform/labor은 SP2/SP3에서 확장) */
export function blankDocument(type: QuoteType): QuoteDocument {
  const simpleColumns = [
    { key: "category", label: "구분", kind: "text" as const },
    { key: "detail", label: "상세내역", kind: "text" as const },
    { key: "note", label: "비고", kind: "text" as const },
    { key: "amount", label: "비용", kind: "amount" as const },
  ];
  return {
    type,
    header: {
      recipient: "",
      quoteName: "",
      quoteNo: "",
      quoteDate: "",
      validUntil: "견적일로부터 30일 이내",
      manager: "",
    },
    sections: [
      { id: "main", title: "견적 내역", columns: simpleColumns, rows: [], subtotal: 0 },
    ],
    totals: { supply: 0, vat: 0, total: 0, vatIncluded: false },
    terms: [],
  };
}
