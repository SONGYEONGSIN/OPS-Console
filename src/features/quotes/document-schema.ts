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
  kind: z.enum(["text", "number", "amount", "multiline"]).default("text"),
});
export const quoteSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.enum(["simple", "labor"]).default("simple"),
  rates: z.object({ overhead: z.number().default(1.1), techFee: z.number().default(0.2) }).optional(),
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

function simpleSection() {
  return {
    id: "main",
    title: "견적 내역",
    kind: "simple" as const,
    columns: [
      { key: "category", label: "구분", kind: "text" as const },
      { key: "detail", label: "상세내역", kind: "text" as const },
      { key: "note", label: "비고", kind: "text" as const },
      { key: "amount", label: "비용", kind: "amount" as const },
    ],
    rows: [],
    subtotal: 0,
  };
}
function platformSection() {
  return {
    id: "main",
    title: "서비스 내역",
    kind: "simple" as const,
    columns: [
      { key: "category", label: "구분", kind: "text" as const },
      { key: "service", label: "세부서비스", kind: "text" as const },
      { key: "features", label: "기능명세", kind: "multiline" as const },
      { key: "period", label: "기간", kind: "text" as const },
      { key: "qty", label: "수량", kind: "text" as const },
      { key: "amount", label: "금액", kind: "amount" as const },
    ],
    rows: [],
    subtotal: 0,
  };
}

function laborSection() {
  return {
    id: "labor",
    title: "인건비 (적산)",
    kind: "labor" as const,
    rates: { overhead: 1.1, techFee: 0.2 },
    columns: [
      { key: "role", label: "직무/등급", kind: "text" as const },
      { key: "count", label: "인원(명)", kind: "number" as const },
      { key: "daily", label: "노임단가(일)", kind: "number" as const },
      { key: "days", label: "투입기간(일)", kind: "number" as const },
      { key: "ratio", label: "참여율", kind: "number" as const },
      { key: "direct", label: "직접인건비", kind: "amount" as const },
    ],
    rows: [],
    subtotal: 0,
  };
}

/** 유형별 빈 문서. dev/fee=4열 simple 섹션, platform=6열 기능나열 섹션, labor=KOSA 인건비 적산 섹션. */
export function blankDocument(type: QuoteType): QuoteDocument {
  const sections =
    type === "platform"
      ? [platformSection()]
      : type === "labor"
        ? [laborSection()]
        : [simpleSection()];
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
    sections,
    totals: { supply: 0, vat: 0, total: 0, vatIncluded: false },
    terms: [],
  };
}
