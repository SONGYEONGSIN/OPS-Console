import { describe, it, expect } from "vitest";
import { quoteRowToListRow } from "../_row-mapper";
import type { QuoteRow } from "@/features/quotes/schemas";

function baseRow(over: Partial<QuoteRow> = {}): QuoteRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    customer: "가천대",
    quote_date: "2026-06-24",
    valid_until: null,
    amount: 1000000,
    owner_email: "ys@example.com",
    status: "draft",
    note: null,
    created_at: "2026-06-24T00:00:00Z",
    updated_at: "2026-06-24T00:00:00Z",
    ...over,
  };
}

describe("quoteRowToListRow — quoteType 매핑", () => {
  it("quote_type 존재 시 그대로 매핑", () => {
    const row = quoteRowToListRow(baseRow({ quote_type: "platform" }));
    expect(row.quoteType).toBe("platform");
  });
  it("quote_type 없으면 dev 기본값", () => {
    const row = quoteRowToListRow(baseRow({ quote_type: undefined }));
    expect(row.quoteType).toBe("dev");
  });
});
