import type { StructuredFieldDef } from "./StructuredInfoForm";

/** 정산 — 전형료 폼 필드 (정산기한/담당자) */
export const PAYMENT_FEE_FIELDS: readonly StructuredFieldDef[] = [
  { key: "deadline", label: "정산기한", placeholder: "예: 5영업일 이내" },
  { key: "manager", label: "담당자", placeholder: "예: ○○○" },
];

/** 정산 — 계산서 폼 필드 (발행유형) */
export const PAYMENT_INVOICE_FIELDS: readonly StructuredFieldDef[] = [
  { key: "issueType", label: "발행유형", placeholder: "예: 청구발행" },
];

export const EMPTY_PAYMENT_FEE = { deadline: "", manager: "", memo: "" };
export const EMPTY_PAYMENT_INVOICE = { issueType: "", memo: "" };
