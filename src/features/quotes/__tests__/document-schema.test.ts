import { describe, it, expect } from "vitest";
import { quoteTypeSchema, quoteDocumentSchema, blankDocument } from "../document-schema";

describe("quoteTypeSchema", () => {
  it("dev/fee/platform/labor 통과, 그 외 거부", () => {
    expect(quoteTypeSchema.safeParse("dev").success).toBe(true);
    expect(quoteTypeSchema.safeParse("x").success).toBe(false);
  });
});
describe("blankDocument", () => {
  it("dev 빈 문서 — type=dev, 섹션 1, 빈 totals", () => {
    const d = blankDocument("dev");
    expect(d.type).toBe("dev");
    expect(d.sections.length).toBeGreaterThanOrEqual(1);
    expect(d.totals.total).toBe(0);
    expect(quoteDocumentSchema.safeParse(d).success).toBe(true);
  });
});
