import { describe, it, expect } from "vitest";
import { onboardingGuideSections } from "../_content";

describe("onboardingGuideSections", () => {
  it("MVP — 최소 4 그룹 이상", () => {
    expect(onboardingGuideSections.length).toBeGreaterThanOrEqual(4);
  });

  it("각 섹션은 ico/title/items 필수", () => {
    for (const s of onboardingGuideSections) {
      expect(s.ico).toBeTruthy();
      expect(s.title).toBeTruthy();
      expect(s.items.length).toBeGreaterThan(0);
    }
  });

  it("모든 항목은 title 보유", () => {
    for (const s of onboardingGuideSections) {
      for (const item of s.items) {
        expect(item.title).toBeTruthy();
      }
    }
  });
});
