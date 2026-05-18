import { describe, it, expect } from "vitest";
import { onboardingResources } from "../_resources";

describe("onboardingResources — 자료실 탭 정적 콘텐츠", () => {
  it("최소 3 그룹 이상", () => {
    expect(onboardingResources.length).toBeGreaterThanOrEqual(3);
  });

  it("각 섹션은 ico/title/items 필수", () => {
    for (const s of onboardingResources) {
      expect(s.ico).toBeTruthy();
      expect(s.title).toBeTruthy();
      expect(s.items.length).toBeGreaterThan(0);
    }
  });

  it("각 항목은 title 필수, url은 string(빈 문자열 허용)", () => {
    for (const s of onboardingResources) {
      for (const item of s.items) {
        expect(item.title).toBeTruthy();
        if (item.url !== undefined) {
          expect(typeof item.url).toBe("string");
        }
      }
    }
  });

  it("외부 URL은 https로 시작", () => {
    for (const s of onboardingResources) {
      for (const item of s.items) {
        if (item.url && !item.url.startsWith("/") && item.url.length > 0) {
          expect(item.url.startsWith("https://")).toBe(true);
        }
      }
    }
  });
});
