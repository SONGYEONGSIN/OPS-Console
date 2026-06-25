import { describe, it, expect } from "vitest";
import {
  sectionSubtotal,
  koreanAmount,
  quoteTotals,
  recomputeDocument,
  rowComputed,
} from "../index";
import { blankDocument } from "../../document-schema";

describe("rowComputed — 행 자동계산", () => {
  it("system: 수량 × 기간 × 단가", () => {
    const sys = blankDocument("dev").sections[0];
    expect(rowComputed(sys, { qty: 2, months: 3, unit: 10000 })).toBe(60000);
  });
  it("outsource: 수량 × 단가", () => {
    const out = blankDocument("dev").sections[2];
    expect(rowComputed(out, { qty: 5, unit: 2000 })).toBe(10000);
  });
  it("labor: laborRowDirect 적산", () => {
    const labor = blankDocument("dev").sections[1];
    expect(rowComputed(labor, { count: 1, daily: 578206, days: 10, ratio: 1 })).toBe(5782060);
  });
  it("summary(기타): amount 직접입력 그대로", () => {
    const sum = blankDocument("dev").sections[3];
    expect(rowComputed(sum, { amount: 12345 })).toBe(12345);
  });
});

describe("recomputeDocument — system/outsource 행 amount 자동 기입", () => {
  it("system 행 amount = 수량×기간×단가, outsource 행 amount = 수량×단가, summary 직접", () => {
    const base = blankDocument("dev");
    const doc = {
      ...base,
      sections: base.sections.map((s) => {
        if (s.id === "system") {
          return { ...s, rows: [{ category: "서버", item: "VM", qty: 2, months: 3, unit: 10000, amount: null }] };
        }
        if (s.id === "outsource") {
          return { ...s, rows: [{ category: "실비", item: "택배", qty: 5, unit: 2000, amount: null }] };
        }
        if (s.id === "summary") {
          return { ...s, rows: [{ category: "합", detail: "x", amount: 1000 }] };
        }
        return s;
      }),
    };
    const r = recomputeDocument(doc);
    const sys = r.sections.find((s) => s.id === "system")!;
    const out = r.sections.find((s) => s.id === "outsource")!;
    const sum = r.sections.find((s) => s.id === "summary")!;
    expect(sys.rows[0].amount).toBe(60000);
    expect(sys.subtotal).toBe(60000);
    expect(out.rows[0].amount).toBe(10000);
    expect(out.subtotal).toBe(10000);
    expect(sum.subtotal).toBe(1000);
    // ④총비용산출(summary)은 ①②③의 산출/요약이므로 supply에서 제외(이중계산 방지)
    expect(r.totals.supply).toBe(60000 + 10000);
  });
});

describe("quoteTotals — summary 섹션 합계 제외", () => {
  it("system 60000 + outsource 10000 + summary 1000 → supply=70000 (summary 제외)", () => {
    const base = blankDocument("dev");
    const doc = recomputeDocument({
      ...base,
      sections: base.sections.map((s) => {
        if (s.id === "system") {
          return { ...s, rows: [{ category: "서버", item: "VM", qty: 2, months: 3, unit: 10000, amount: null }] };
        }
        if (s.id === "outsource") {
          return { ...s, rows: [{ category: "실비", item: "택배", qty: 5, unit: 2000, amount: null }] };
        }
        if (s.id === "summary") {
          return { ...s, rows: [{ category: "합", detail: "x", amount: 1000 }] };
        }
        return s;
      }),
    });
    // summary 섹션 subtotal은 표시용으로 계속 계산되지만 supply에는 미반영
    const sum = doc.sections.find((s) => s.id === "summary")!;
    expect(sum.subtotal).toBe(1000);
    expect(doc.totals.supply).toBe(70000);
  });
});

describe("sectionSubtotal", () => {
  it("amount 컬럼 합", () => {
    const s = {
      id: "main", title: "", kind: "simple" as const, note: "", subtotal: 0,
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
        id: "main", title: "", kind: "simple" as const, note: "", subtotal: 0,
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
        id: "main", title: "", kind: "simple" as const, note: "", subtotal: 0,
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
          id: "sec1", title: "섹션1", kind: "simple" as const, note: "", subtotal: 0,
          columns: [{ key: "amount", label: "비용", kind: "amount" as const }],
          rows: [{ amount: 300000 }],
        },
        {
          id: "sec2", title: "섹션2", kind: "simple" as const, note: "", subtotal: 0,
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
