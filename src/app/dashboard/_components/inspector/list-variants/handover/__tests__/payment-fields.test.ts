import { describe, it, expect } from "vitest";
import {
  PAYMENT_FEE_FIELDS,
  PAYMENT_INVOICE_FIELDS,
} from "../payment-fields";

describe("payment-fields", () => {
  it("전형료 — 정산기한 셀렉트 (4개 옵션)", () => {
    expect(PAYMENT_FEE_FIELDS.map((f) => f.key)).toEqual(["deadline"]);
    expect(PAYMENT_FEE_FIELDS[0].options).toEqual([
      "5일 이내",
      "10일 이내",
      "20일 이내",
      "30일 이내",
    ]);
  });

  it("계산서 — 발행유형 셀렉트 (학생부담/청구/영수)", () => {
    expect(PAYMENT_INVOICE_FIELDS.map((f) => f.key)).toEqual(["issueType"]);
    expect(PAYMENT_INVOICE_FIELDS[0].options).toEqual([
      "학생부담",
      "청구",
      "영수",
    ]);
  });
});
