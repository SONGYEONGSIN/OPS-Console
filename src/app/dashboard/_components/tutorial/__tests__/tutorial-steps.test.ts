import { describe, it, expect } from "vitest";
import { TUTORIAL_STEPS, TUTORIAL_SEEN_KEY } from "../tutorial-steps";

describe("TUTORIAL_STEPS", () => {
  it("5단계로 구성된다", () => {
    expect(TUTORIAL_STEPS).toHaveLength(5);
  });

  it("각 스텝은 비어있지 않은 title/description를 가진다", () => {
    for (const step of TUTORIAL_STEPS) {
      expect(step.title.trim().length).toBeGreaterThan(0);
      expect(step.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("영역 스포트라이트 스텝은 element 선택자를 가진다 (사이드바/상단/콘텐츠/도움말)", () => {
    const anchored = TUTORIAL_STEPS.filter((s) => s.element);
    expect(anchored.length).toBeGreaterThanOrEqual(4);
    expect(TUTORIAL_STEPS.some((s) => s.element === "#sidebar")).toBe(true);
    expect(
      TUTORIAL_STEPS.some((s) => s.element === "[data-tutorial='topbar']"),
    ).toBe(true);
    expect(
      TUTORIAL_STEPS.some((s) => s.element === "[data-tutorial='content']"),
    ).toBe(true);
    expect(
      TUTORIAL_STEPS.some((s) => s.element === "[data-tutorial='help']"),
    ).toBe(true);
  });
});

describe("TUTORIAL_SEEN_KEY", () => {
  it("버전을 포함한다 (스텝 개편 시 재노출 가능)", () => {
    expect(TUTORIAL_SEEN_KEY).toMatch(/v\d+/);
  });
});
