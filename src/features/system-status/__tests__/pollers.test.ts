import { describe, it, expect } from "vitest";
import { POLLERS } from "../pollers";

/**
 * 폴러 레지스트리. 여기 없으면 화면에도 없다 — 실제로 어시스턴트가 죽어 있는데
 * 아무 데도 안 나오던 게 이 기능을 만든 이유다.
 */
describe("회사 PC 폴러 목록", () => {
  it("어시스턴트가 들어 있다", () => {
    const a = POLLERS.find((p) => p.id === "assistant");
    expect(a?.table).toBe("assistant_requests");
  });

  it("여섯 개 큐를 모두 본다", () => {
    expect(POLLERS.map((p) => p.table).sort()).toEqual(
      [
        "assistant_requests",
        "closing_scrape_requests",
        "dev_control_analyze_requests",
        "entertest_test_runs",
        "postal_extract_requests",
        "ratio_audit_requests",
      ].sort(),
    );
  });

  it("같은 큐를 두 번 보지 않는다", () => {
    expect(new Set(POLLERS.map((p) => p.table)).size).toBe(POLLERS.length);
  });

  it("임계가 폴러마다 다르다 — 상주와 5분 폴링을 같은 잣대로 못 본다", () => {
    const assistant = POLLERS.find((p) => p.id === "assistant");
    const ratio = POLLERS.find((p) => p.id === "ratio-audit");
    expect(assistant?.thresholdMinutes).toBeLessThan(
      ratio?.thresholdMinutes ?? 0,
    );
  });

  it("어시스턴트 임계는 화면이 기다리는 3분보다 짧다 — 그 안에 드러나야 한다", () => {
    const a = POLLERS.find((p) => p.id === "assistant");
    expect(a?.thresholdMinutes).toBeLessThan(3);
  });

  it("멈췄을 때 무엇을 할지 모두 적혀 있다 — 상태만 알려주면 소용없다", () => {
    for (const p of POLLERS) {
      expect(p.hint, p.id).not.toBe("");
      expect(p.label, p.id).not.toBe("");
    }
  });
});
