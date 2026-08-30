import { describe, it, expect } from "vitest";
import { AGGREGATOR_REGISTRY, AGGREGATOR_KEYS } from "./registry";

describe("AGGREGATOR_REGISTRY", () => {
  /**
   * 개수를 못박지 않는다 — 소스가 늘 때마다 이 테스트가 걸리는데, 그건 어긋남이
   * 아니라 정상적인 확장이다. 지켜야 할 건 **모든 엔트리가 계약을 채우는 것**이다.
   */
  it("모든 소스 키가 label/unit/source/kind 를 채운다", () => {
    expect(AGGREGATOR_KEYS.length).toBeGreaterThan(0);
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
