import { describe, it, expect } from "vitest";
import {
  PAYMENT_FEE_FIELDS,
  PAYMENT_INVOICE_FIELDS,
} from "../payment-fields";

describe("payment-fields", () => {
  it("전형료 — 정산기한/담당자 필드", () => {
    expect(PAYMENT_FEE_FIELDS.map((f) => f.key)).toEqual([
      "deadline",
      "manager",
    ]);
  });

  it("계산서 — 발행유형 필드", () => {
    expect(PAYMENT_INVOICE_FIELDS.map((f) => f.key)).toEqual(["issueType"]);
  });
});
