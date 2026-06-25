import { describe, it, expect } from "vitest";
import { sectionSubtotal, koreanAmount, recomputeDocument } from "../index";
import { blankDocument } from "../../document-schema";

describe("sectionSubtotal", () => {
  it("amount 컬럼 합", () => {
    const s = {
      id: "main", title: "", subtotal: 0,
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
        id: "main", title: "", subtotal: 0,
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
});
