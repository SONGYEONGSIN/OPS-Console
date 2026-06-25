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
describe("blankDocument platform", () => {
  it("platform 섹션 컬럼 = 구분·세부서비스·기능명세·기간·수량·금액", () => {
    const d = blankDocument("platform");
    expect(d.type).toBe("platform");
    const keys = d.sections[0].columns.map((c) => c.key);
    expect(keys).toEqual(["category", "service", "features", "period", "qty", "amount"]);
    const amountCol = d.sections[0].columns.find((c) => c.key === "amount");
    expect(amountCol?.kind).toBe("amount");
    const featCol = d.sections[0].columns.find((c) => c.key === "features");
    expect(featCol?.kind).toBe("multiline");
    expect(quoteDocumentSchema.safeParse(d).success).toBe(true);
  });
  it("dev는 기존 simple 4열 유지", () => {
    const d = blankDocument("dev");
    expect(d.sections[0].columns.map((c) => c.key)).toEqual(["category", "detail", "note", "amount"]);
  });
  it("labor — KOSA 인건비 적산 6열 반환", () => {
    const d = blankDocument("labor");
    expect(d.type).toBe("labor");
    expect(d.sections[0].kind).toBe("labor");
    expect(d.sections[0].columns.map((c) => c.key)).toEqual([
      "role",
      "count",
      "daily",
      "days",
      "ratio",
      "direct",
    ]);
    expect(d.sections[0].rates).toEqual({ overhead: 1.1, techFee: 0.2 });
    expect(quoteDocumentSchema.safeParse(d).success).toBe(true);
  });
});
