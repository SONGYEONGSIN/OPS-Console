import { describe, it, expect } from "vitest";
import { INSPECTOR_LAYOUT, inspectorLayoutFor } from "../inspector-layout";

describe("INSPECTOR_LAYOUT", () => {
  it("표준은 인스펙터 320 / 목록 여백 340", () => {
    expect(INSPECTOR_LAYOUT.standard).toEqual({
      panel: "md:w-[320px]",
      gutter: "md:pr-[340px]",
    });
  });

  it("넓은 폭은 인스펙터 560 / 목록 여백 580 (폭 + 20)", () => {
    expect(INSPECTOR_LAYOUT.wide).toEqual({
      panel: "md:w-[560px]",
      gutter: "md:pr-[580px]",
    });
  });
});

describe("inspectorLayoutFor", () => {
  it("incidents 편집 중 → 넓은 폭", () => {
    expect(inspectorLayoutFor("incidents", true)).toBe(INSPECTOR_LAYOUT.wide);
  });

  it("incidents 보기 모드 → 표준", () => {
    expect(inspectorLayoutFor("incidents", false)).toBe(
      INSPECTOR_LAYOUT.standard,
    );
  });

  it("다른 variant 는 편집 중이어도 표준", () => {
    expect(inspectorLayoutFor("default", true)).toBe(INSPECTOR_LAYOUT.standard);
    expect(inspectorLayoutFor("incident-reports", true)).toBe(
      INSPECTOR_LAYOUT.standard,
    );
    expect(inspectorLayoutFor("contacts", true)).toBe(
      INSPECTOR_LAYOUT.standard,
    );
  });
});
