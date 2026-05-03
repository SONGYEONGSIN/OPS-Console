import { describe, it, expect } from "vitest";
import { buildSearchItems, filterItems } from "../searchItems";
import { sidebarSections } from "../../_data";

describe("buildSearchItems", () => {
  const items = buildSearchItems(sidebarSections);

  it("slug 있는 모든 sidebar 항목을 flat list로 변환", () => {
    expect(items.length).toBeGreaterThan(30);
    expect(items.every((i) => i.slug && i.label)).toBe(true);
  });

  it("group 자식까지 평탄화 (PIMS, 접수관리자 등 포함)", () => {
    expect(items.find((i) => i.slug === "pims")?.label).toBe("PIMS");
    expect(items.find((i) => i.slug === "reception-admin")?.label).toBe("접수관리자");
  });

  it("group 라벨을 컨텍스트로 함께 보유 (예: 프로젝트 > PIMS)", () => {
    const pims = items.find((i) => i.slug === "pims");
    expect(pims?.group).toBe("프로젝트");
  });

  it("최상위 item (인수인계 등)도 포함", () => {
    const handover = items.find((i) => i.slug === "handover");
    expect(handover?.label).toBe("인수인계");
  });

  it("slug 없는 item ('실시간 현황')은 제외", () => {
    expect(items.find((i) => i.label === "실시간 현황")).toBeUndefined();
  });
});

describe("filterItems", () => {
  const items = buildSearchItems(sidebarSections);

  it("빈 쿼리는 빈 배열 반환", () => {
    expect(filterItems(items, "")).toEqual([]);
    expect(filterItems(items, "   ")).toEqual([]);
  });

  it("label 부분 매치 ('pims' → PIMS)", () => {
    const r = filterItems(items, "pims");
    expect(r.some((i) => i.slug === "pims")).toBe(true);
  });

  it("한글 label 부분 매치 ('정산' → 정산·진학캐쉬, 전형료 정산)", () => {
    const r = filterItems(items, "정산");
    const slugs = r.map((i) => i.slug);
    expect(slugs).toContain("jh-cash");
    expect(slugs).toContain("settlement");
  });

  it("대소문자 구분 없음 ('PIMS' === 'pims')", () => {
    expect(filterItems(items, "PIMS")[0]?.slug).toBe("pims");
    expect(filterItems(items, "pims")[0]?.slug).toBe("pims");
  });

  it("매치 없으면 빈 배열", () => {
    expect(filterItems(items, "zzzz존재하지않음xxxx")).toEqual([]);
  });

  it("결과 8개 이하로 제한", () => {
    const r = filterItems(items, "·");
    expect(r.length).toBeLessThanOrEqual(8);
  });
});
