import { describe, it, expect } from "vitest";
import { POSTAL_TABS } from "../tabs";

/**
 * 탭 라벨은 화면의 길 안내다. '우편물 > 우편물' 로 겹쳐 읽히던 것을
 * '우편물 > 등기관리' 으로 바꿨다 — 페이지 제목이 이미 우편물이다.
 */
describe("우편물 탭", () => {
  it("첫 탭은 등기관리이다", () => {
    expect(POSTAL_TABS[0]).toMatchObject({
      key: "receipts",
      label: "등기관리",
    });
  });

  it("두 탭뿐이다 — 등기관리·전도금", () => {
    expect(POSTAL_TABS.map((t) => t.label)).toEqual(["등기관리", "전도금"]);
  });

  it("각 탭이 자기 tab 파라미터를 가리킨다", () => {
    for (const t of POSTAL_TABS) {
      expect(t.href).toBe(`/dashboard/postal?tab=${t.key}`);
    }
  });
});
