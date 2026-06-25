import { describe, it, expect } from "vitest";
import { laborRollup, sectionSubtotal, laborRowDirect, recomputeDocument } from "../index";
import { kosaDaily } from "../../kosa-2026";
import { blankDocument } from "../../document-schema";

describe("kosaDaily", () => {
  it("등급 단가 lookup", () => {
    expect(kosaDaily("planner")).toBe(578206);
    expect(kosaDaily("tester")).toBe(197714);
    expect(kosaDaily("없는등급")).toBe(0);
  });
});
describe("laborRollup", () => {
  it("제경비 110% + 기술료 20% 적산", () => {
    const r = laborRollup({ direct: 1000000, overheadRate: 1.1, techFeeRate: 0.2 });
    expect(r.overhead).toBe(1100000);          // 직접 × 1.1
    expect(r.techFee).toBe(420000);            // (100만+110만) × 0.2
    expect(r.total).toBe(2520000);             // 100만+110만+42만
  });
});
describe("sectionSubtotal labor", () => {
  it("직접인건비=인원×단가×투입일×참여율 합 → 적산 = 인건비합계", () => {
    // 1명 × 578206 × 10일 × 1.0 = 5,782,060 직접
    const section = {
      id: "labor", title: "인건비", kind: "labor" as const,
      rates: { overhead: 1.1, techFee: 0.2 },
      columns: [
        { key: "role", label: "직무", kind: "text" as const },
        { key: "count", label: "인원", kind: "number" as const },
        { key: "daily", label: "노임단가", kind: "number" as const },
        { key: "days", label: "투입일", kind: "number" as const },
        { key: "ratio", label: "참여율", kind: "number" as const },
        { key: "direct", label: "직접인건비", kind: "amount" as const },
      ],
      rows: [{ role: "기획", count: 1, daily: 578206, days: 10, ratio: 1, direct: null }],
      subtotal: 0,
    };
    // 직접합 = 5,782,060 → 제경비 6,360,266 → 기술료 (5782060+6360266)*0.2=2,428,465.2→round 2428465 → 합계 14,570,791
    expect(sectionSubtotal(section)).toBe(5782060 + 6360266 + 2428465);
  });
});

describe("blankDocument labor", () => {
  it('kind === "labor" 섹션 반환, 컬럼 role/count/daily/days/ratio/direct 포함', () => {
    const doc = blankDocument("labor");
    expect(doc.sections).toHaveLength(1);
    const s = doc.sections[0];
    expect(s.kind).toBe("labor");
    const keys = s.columns.map((c) => c.key);
    expect(keys).toContain("role");
    expect(keys).toContain("count");
    expect(keys).toContain("daily");
    expect(keys).toContain("days");
    expect(keys).toContain("ratio");
    expect(keys).toContain("direct");
  });
});

describe("laborRowDirect", () => {
  it("인원×노임단가×투입일×참여율 반올림", () => {
    expect(laborRowDirect({ count: 1, daily: 578206, days: 10, ratio: 1 })).toBe(5782060);
    expect(laborRowDirect({ count: 2, daily: 378250, days: 5, ratio: 0.5 })).toBe(1891250);
    expect(laborRowDirect({ count: 0, daily: 578206, days: 10, ratio: 1 })).toBe(0);
  });
});

describe("recomputeDocument labor 행 direct 기입", () => {
  it("labor 섹션 행 direct 자동 계산 + totals.supply 인건비합계 반영", () => {
    // 1명 × 578206 × 10일 × 1.0 = 5,782,060
    const input = blankDocument("labor");
    const doc = {
      ...input,
      sections: [{
        ...input.sections[0],
        rows: [{ role: "기획", count: 1, daily: 578206, days: 10, ratio: 1, direct: null }],
      }],
    };
    const result = recomputeDocument(doc);
    const row = result.sections[0].rows[0];
    expect(row.direct).toBe(5782060);
    // 인건비합계 = 5782060 + 6360266 + 2428465 = 14570791
    expect(result.sections[0].subtotal).toBe(14570791);
    expect(result.totals.supply).toBe(14570791);
  });
});
