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
  recipientCount: z.string().default(""),
  paymentTerms: z.string().default("계약서 항목에 따름"),
  managerTel: z.string().default(""),
  managerEmail: z.string().default(""),
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
  note: z.string().default(""),
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
  guide: z.array(z.string()).default([]),
  terms: z.array(z.string()).default([]),
});
export type QuoteDocument = z.infer<typeof quoteDocumentSchema>;

/** 1. 시스템 이용 — 수량×기간×단가 자동계산. */
function systemSection() {
  return {
    id: "system",
    title: "1. 시스템(인프라·장비) 이용",
    kind: "simple" as const,
    note: "",
    columns: [
      { key: "category", label: "구분", kind: "text" as const },
      { key: "item", label: "항목", kind: "text" as const },
      { key: "qty", label: "수량", kind: "number" as const },
      { key: "months", label: "기간(월)", kind: "number" as const },
      { key: "unit", label: "단가(원/월)", kind: "number" as const },
      { key: "amount", label: "금액", kind: "amount" as const },
    ],
    rows: [],
    subtotal: 0,
  };
}

/** 2. 인건비 — SP3 KOSA 6열 적산(직접인건비·제경비·기술료). */
function laborSection() {
  return {
    id: "labor",
    title: "2. 인건비 (직접인건비·제경비·기술료)",
    kind: "labor" as const,
    note: "",
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

/** 3. 외주비/비용 — 수량×단가 자동계산. */
function outsourceSection() {
  return {
    id: "outsource",
    title: "3. 외주비/비용 (장비·실비·수수료)",
    kind: "simple" as const,
    note: "",
    columns: [
      { key: "category", label: "구분", kind: "text" as const },
      { key: "item", label: "항목", kind: "text" as const },
      { key: "qty", label: "수량/건수", kind: "number" as const },
      { key: "unit", label: "단가", kind: "number" as const },
      { key: "amount", label: "금액", kind: "amount" as const },
    ],
    rows: [],
    subtotal: 0,
  };
}

/** 4. 총 비용 및 단가 산출 — 금액 직접입력. */
function summarySection() {
  return {
    id: "summary",
    title: "4. 총 비용 및 단가 산출",
    kind: "simple" as const,
    note: "",
    columns: [
      { key: "category", label: "구분", kind: "text" as const },
      { key: "detail", label: "내역", kind: "text" as const },
      { key: "amount", label: "금액", kind: "amount" as const },
    ],
    rows: [],
    subtotal: 0,
  };
}

/** 전 유형 동일 4섹션 빈 문서. type은 라벨/badge용. */
export function blankDocument(type: QuoteType): QuoteDocument {
  return {
    type,
    header: {
      recipient: "",
      quoteName: "",
      quoteNo: "",
      quoteDate: "",
      validUntil: "견적일로부터 30일 이내",
      manager: "",
      recipientCount: "",
      paymentTerms: "계약서 항목에 따름",
      managerTel: "",
      managerEmail: "",
    },
    sections: [systemSection(), laborSection(), outsourceSection(), summarySection()],
    totals: { supply: 0, vat: 0, total: 0, vatIncluded: false },
    guide: [],
    terms: [],
  };
}
