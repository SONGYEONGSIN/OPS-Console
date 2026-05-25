import { describe, it, expect } from "vitest";
import { OPERATING_GUIDE_TABS, findTabByValue } from "../tabs";

describe("OPERATING_GUIDE_TABS", () => {
  it("6개 탭 정의 (바이브코딩/노하우/SOP/트러블슈팅/협업/도구)", () => {
    expect(OPERATING_GUIDE_TABS).toHaveLength(6);
    const values = OPERATING_GUIDE_TABS.map((t) => t.value);
    expect(values).toEqual([
      "vibe-coding",
      "know-how",
      "standard-procedure",
      "troubleshooting",
      "collaboration",
      "tools",
    ]);
  });

  it("각 탭은 라벨·설명·sections 보유", () => {
    for (const tab of OPERATING_GUIDE_TABS) {
      expect(tab.label.length).toBeGreaterThan(0);
      expect(tab.desc.length).toBeGreaterThan(0);
      expect(tab.sections.length).toBeGreaterThan(0);
      for (const sec of tab.sections) {
        expect(sec.heading.length).toBeGreaterThan(0);
        expect(sec.body.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("findTabByValue", () => {
  it("'vibe-coding' → 바이브코딩 탭", () => {
    const t = findTabByValue("vibe-coding");
    expect(t).toBeDefined();
    expect(t?.label).toBe("바이브코딩");
  });

  it("미존재 value → undefined", () => {
    expect(findTabByValue("does-not-exist")).toBeUndefined();
  });
});
