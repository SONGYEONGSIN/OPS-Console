import type { StructuredFieldDef } from "./StructuredInfoForm";

/** 정산 — 전형료 폼 필드 (정산기한 셀렉트) */
export const PAYMENT_FEE_FIELDS: readonly StructuredFieldDef[] = [
  {
    key: "deadline",
    label: "정산기한",
    options: ["5일 이내", "10일 이내", "20일 이내", "30일 이내"],
  },
];

/** 정산 — 계산서 폼 필드 (발행유형 셀렉트) */
export const PAYMENT_INVOICE_FIELDS: readonly StructuredFieldDef[] = [
  {
    key: "issueType",
    label: "발행유형",
    options: ["학생부담", "청구", "영수"],
  },
];

export const EMPTY_PAYMENT_FEE = { deadline: "", manager: "", memo: "" };
export const EMPTY_PAYMENT_INVOICE = { issueType: "", memo: "" };
