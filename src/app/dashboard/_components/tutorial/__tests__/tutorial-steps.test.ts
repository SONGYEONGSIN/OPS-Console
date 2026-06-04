import { describe, it, expect } from "vitest";
import { INTRO_STEPS, TUTORIAL_SEEN_KEY } from "../tutorial-steps";

describe("INTRO_STEPS", () => {
  it("5단계로 구성된다", () => {
    expect(INTRO_STEPS).toHaveLength(5);
  });

  it("각 스텝은 비어있지 않은 title/description를 가진다", () => {
    for (const step of INTRO_STEPS) {
      expect(step.title.trim().length).toBeGreaterThan(0);
      expect(step.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("영역 스포트라이트 스텝은 element 선택자를 가진다 (사이드바/상단/콘텐츠)", () => {
    const anchored = INTRO_STEPS.filter((s) => s.element);
    expect(anchored.length).toBeGreaterThanOrEqual(3);
    expect(INTRO_STEPS.some((s) => s.element === "#sidebar")).toBe(true);
    expect(
      INTRO_STEPS.some((s) => s.element === "[data-tutorial='topbar']"),
    ).toBe(true);
    expect(
      INTRO_STEPS.some((s) => s.element === "[data-tutorial='content']"),
    ).toBe(true);
  });
});

describe("TUTORIAL_SEEN_KEY", () => {
  it("v2 버전을 포함한다 (스텝 개편 시 기존 사용자에게 재노출)", () => {
    expect(TUTORIAL_SEEN_KEY).toMatch(/v2/);
  });
});
