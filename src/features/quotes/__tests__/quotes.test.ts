import { describe, it, expect } from "vitest";
import { quoteInputSchema, quoteStatusSchema, QUOTE_STATUS_LABEL } from "../schemas";

describe("quoteStatusSchema", () => {
  it("유효 상태 통과 / 무효 거부", () => {
    expect(quoteStatusSchema.safeParse("won").success).toBe(true);
    expect(quoteStatusSchema.safeParse("xxx").success).toBe(false);
  });
});

describe("quoteInputSchema", () => {
  it("customer 빈 값 거부 (issues[0].message)", () => {
    const r = quoteInputSchema.safeParse({
      customer: "",
      quote_date: "2026-06-24",
      status: "draft",
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toContain("고객");
  });
  it("정상 입력 통과", () => {
    const r = quoteInputSchema.safeParse({
      customer: "가천대",
      quote_date: "2026-06-24",
      amount: 1000000,
      status: "sent",
      valid_until: null,
      note: null,
      owner_email: "ys1114@jinhakapply.com",
    });
    expect(r.success).toBe(true);
  });
});

describe("QUOTE_STATUS_LABEL", () => {
  it("4 상태 한국어 라벨", () => {
    expect(QUOTE_STATUS_LABEL.draft).toBe("작성중");
    expect(QUOTE_STATUS_LABEL.lost).toBe("실주");
  });
});
