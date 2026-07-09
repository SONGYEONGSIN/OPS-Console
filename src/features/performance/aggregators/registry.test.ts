import { describe, it, expect } from "vitest";
import { AGGREGATOR_REGISTRY, AGGREGATOR_KEYS } from "./registry";

describe("AGGREGATOR_REGISTRY", () => {
  it("3개 소스 키가 등록되어 있고 label/unit/kind 보유", () => {
    expect(AGGREGATOR_KEYS).toHaveLength(3);
    for (const k of AGGREGATOR_KEYS) {
      expect(AGGREGATOR_REGISTRY[k].label).toBeTruthy();
      expect(AGGREGATOR_REGISTRY[k].unit).toBeTruthy();
      expect(AGGREGATOR_REGISTRY[k].source).toBeTruthy();
      expect(["rate", "count"]).toContain(AGGREGATOR_REGISTRY[k].kind);
    }
  });

  it("사고 처리완료율만 rate(달성률 직결), 나머지는 count", () => {
    expect(AGGREGATOR_REGISTRY["incident-resolve-rate"].kind).toBe("rate");
    expect(AGGREGATOR_REGISTRY["closing-completed"].kind).toBe("count");
    expect(AGGREGATOR_REGISTRY["ai-work-count"].kind).toBe("count");
  });
});
