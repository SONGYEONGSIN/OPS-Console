import { describe, it, expect } from "vitest";
import {
  quoteTypeSchema,
  quoteDocumentSchema,
  quoteHeaderSchema,
  quoteSectionSchema,
  blankDocument,
} from "../document-schema";

describe("quoteTypeSchema", () => {
  it("dev/fee/platform/labor 통과, 그 외 거부", () => {
    expect(quoteTypeSchema.safeParse("dev").success).toBe(true);
    expect(quoteTypeSchema.safeParse("x").success).toBe(false);
  });
});

describe("quoteHeaderSchema 확장", () => {
  it("recipientCount/paymentTerms/managerTel/managerEmail 기본값", () => {
    const h = quoteHeaderSchema.parse({});
    expect(h.recipientCount).toBe("");
    expect(h.paymentTerms).toBe("계약서 항목에 따름");
    expect(h.managerTel).toBe("");
    expect(h.managerEmail).toBe("");
  });
});

describe("quoteSectionSchema note", () => {
  it("note 기본값 빈 문자열", () => {
    const s = quoteSectionSchema.parse({
      id: "x",
      title: "t",
      columns: [],
      rows: [],
    });
    expect(s.note).toBe("");
  });
});

describe("quoteDocumentSchema guide", () => {
  it("guide 기본값 빈 배열", () => {
    const d = blankDocument("dev");
    const parsed = quoteDocumentSchema.parse(d);
    expect(Array.isArray(parsed.guide)).toBe(true);
  });
});

describe("blankDocument — 전 유형 4섹션 고정", () => {
  it("dev — system/labor/outsource/summary 4섹션", () => {
    const d = blankDocument("dev");
    expect(d.type).toBe("dev");
    expect(d.sections.map((s) => s.id)).toEqual([
      "system",
      "labor",
      "outsource",
      "summary",
    ]);
    expect(d.totals.total).toBe(0);
    expect(quoteDocumentSchema.safeParse(d).success).toBe(true);
  });

  it("platform/fee/labor 모두 동일 4섹션", () => {
    for (const t of ["platform", "fee", "labor"] as const) {
      const d = blankDocument(t);
      expect(d.sections.map((s) => s.id)).toEqual([
        "system",
        "labor",
        "outsource",
        "summary",
      ]);
    }
  });

  it("system 섹션 — 구분·항목·수량·기간(월)·단가·금액 6열", () => {
    const sys = blankDocument("dev").sections[0];
    expect(sys.id).toBe("system");
    expect(sys.title).toBe("1. 시스템(인프라·장비) 이용");
    expect(sys.columns.map((c) => c.key)).toEqual([
      "category",
      "item",
      "qty",
      "months",
      "unit",
      "amount",
    ]);
  });

  it("labor 섹션 — KOSA 6열 + kind:labor + rates + 새 title", () => {
    const labor = blankDocument("dev").sections[1];
    expect(labor.id).toBe("labor");
    expect(labor.kind).toBe("labor");
    expect(labor.title).toBe("2. 인건비 (직접인건비·제경비·기술료)");
    expect(labor.rates).toEqual({ overhead: 1.1, techFee: 0.2 });
    expect(labor.columns.map((c) => c.key)).toEqual([
      "role",
      "count",
      "daily",
      "days",
      "ratio",
      "direct",
    ]);
  });

  it("outsource 섹션 — 구분·항목·수량/건수·단가·금액 5열", () => {
    const out = blankDocument("dev").sections[2];
    expect(out.id).toBe("outsource");
    expect(out.title).toBe("3. 외주비/비용 (장비·실비·수수료)");
    expect(out.columns.map((c) => c.key)).toEqual([
      "category",
      "item",
      "qty",
      "unit",
      "amount",
    ]);
  });

  it("summary 섹션 — 구분·내역·금액 3열", () => {
    const sum = blankDocument("dev").sections[3];
    expect(sum.id).toBe("summary");
    expect(sum.title).toBe("4. 총 비용 및 단가 산출");
    expect(sum.columns.map((c) => c.key)).toEqual([
      "category",
      "detail",
      "amount",
    ]);
  });

  it("header에 paymentTerms 기본값 포함", () => {
    const d = blankDocument("dev");
    expect(d.header.paymentTerms).toBe("계약서 항목에 따름");
    expect(d.header.validUntil).toBe("견적일로부터 30일 이내");
  });
});
