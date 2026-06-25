import { describe, it, expect } from "vitest";
import { laborRollup, sectionSubtotal } from "../index";
import { kosaDaily } from "../../kosa-2026";

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
