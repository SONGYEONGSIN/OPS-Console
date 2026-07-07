import { describe, it, expect } from "vitest";
import { AGGREGATOR_REGISTRY, AGGREGATOR_KEYS } from "./registry";

describe("AGGREGATOR_REGISTRY", () => {
  it("3개 소스 키가 등록되어 있고 label/unit 보유", () => {
    expect(AGGREGATOR_KEYS).toHaveLength(3);
    for (const k of AGGREGATOR_KEYS) {
      expect(AGGREGATOR_REGISTRY[k].label).toBeTruthy();
      expect(AGGREGATOR_REGISTRY[k].unit).toBeTruthy();
      expect(AGGREGATOR_REGISTRY[k].source).toBeTruthy();
    }
  });
});
