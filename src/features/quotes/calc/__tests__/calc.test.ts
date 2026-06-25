import { describe, it, expect } from "vitest";
import { sectionSubtotal, koreanAmount, quoteTotals, recomputeDocument } from "../index";
import { blankDocument } from "../../document-schema";

describe("sectionSubtotal", () => {
  it("amount 컬럼 합", () => {
    const s = {
      id: "main", title: "", kind: "simple" as const, subtotal: 0,
      columns: [{ key: "amount", label: "비용", kind: "amount" as const }],
      rows: [{ amount: 1000 }, { amount: 2000 }, { amount: null }],
    };
    expect(sectionSubtotal(s)).toBe(3000);
  });
});

describe("quoteTotals", () => {
  it("공급가→부가세10%→합계", () => {
    const d = recomputeDocument({
      ...blankDocument("dev"),
      sections: [{
        id: "main", title: "", kind: "simple" as const, subtotal: 0,
        columns: [{ key: "amount", label: "비용", kind: "amount" as const }],
        rows: [{ amount: 1000000 }],
      }],
    });
    expect(d.totals.supply).toBe(1000000);
    expect(d.totals.vat).toBe(100000);
    expect(d.totals.total).toBe(1100000);
  });
});

describe("koreanAmount", () => {
  it("일금 변환", () => {
    expect(koreanAmount(1100000)).toContain("일백십만");
  });
  it("0 → 영원/빈", () => {
    expect(typeof koreanAmount(0)).toBe("string");
  });
  it("1100000 → 일백십만", () => {
    expect(koreanAmount(1100000)).toBe("일백십만");
  });
  it("35000000 → 삼천오백만", () => {
    expect(koreanAmount(35000000)).toBe("삼천오백만");
  });
  it("1000 → 일천", () => {
    expect(koreanAmount(1000)).toBe("일천");
  });
  it("10000 → 일만", () => {
    expect(koreanAmount(10000)).toBe("일만");
  });
  it("100000000 → 일억", () => {
    expect(koreanAmount(100000000)).toBe("일억");
  });
  it("110000000 → 일억일천만", () => {
    expect(koreanAmount(110000000)).toBe("일억일천만");
  });
  it("0.5 (소수) → 영", () => {
    expect(koreanAmount(0.5)).toBe("영");
  });
  it("-100 (음수) → 영", () => {
    expect(koreanAmount(-100)).toBe("영");
  });
});

describe("quoteTotals — vatIncluded 역산", () => {
  it("total=1100000 입력 시 supply=1000000, vat=100000", () => {
    const d = {
      ...blankDocument("dev"),
      sections: [{
        id: "main", title: "", kind: "simple" as const, subtotal: 0,
        columns: [{ key: "amount", label: "비용", kind: "amount" as const }],
        rows: [{ amount: 1100000 }],
      }],
      totals: { supply: 0, vat: 0, total: 0, vatIncluded: true },
    };
    const result = quoteTotals(d, { vatIncluded: true });
    expect(result.supply).toBe(1000000);
    expect(result.vat).toBe(100000);
    expect(result.total).toBe(1100000);
    expect(result.supply + result.vat).toBe(result.total);
  });
});

describe("recomputeDocument — 멀티섹션 소계 합산", () => {
  it("섹션 2개 소계 합 === totals.supply", () => {
    const d = recomputeDocument({
      ...blankDocument("dev"),
      sections: [
        {
          id: "sec1", title: "섹션1", kind: "simple" as const, subtotal: 0,
          columns: [{ key: "amount", label: "비용", kind: "amount" as const }],
          rows: [{ amount: 300000 }],
        },
        {
          id: "sec2", title: "섹션2", kind: "simple" as const, subtotal: 0,
          columns: [{ key: "amount", label: "비용", kind: "amount" as const }],
          rows: [{ amount: 700000 }],
        },
      ],
    });
    const subtotalSum = d.sections.reduce((acc, s) => acc + s.subtotal, 0);
    expect(subtotalSum).toBe(1000000);
    expect(d.totals.supply).toBe(subtotalSum);
  });
});
