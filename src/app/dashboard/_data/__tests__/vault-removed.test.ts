import { describe, it, expect } from "vitest";
import { sidebarSections } from "../../_data";
import { getAllMenuSlugs } from "../sidebar-helpers";

const allItems = sidebarSections.flatMap((s) =>
  s.entries.flatMap((e) => (e.kind === "item" ? [e] : e.items)),
);

/**
 * 자료실을 걷어냈다. 전용 화면 없이 목업만 그리던 자리라, 눌러도 가짜 데이터가
 * 나왔다. 쓰지 않는 메뉴가 목록에 있으면 있는 기능인 줄 안다.
 */
describe("자료실 메뉴 제거", () => {
  it("사이드바에 없다", () => {
    expect(allItems.find((i) => i.slug === "vault")).toBeUndefined();
  });

  it("메뉴 슬러그 목록에도 없다 — 권한 기본값이 이걸로 만들어진다", () => {
    expect(getAllMenuSlugs()).not.toContain("vault");
  });

  it("자료보관 그룹은 남는다 — 회의록·견적서가 거기 있다", () => {
    const group = sidebarSections
      .flatMap((s) => s.entries)
      .find((e) => e.kind === "group" && e.label === "자료보관");
    expect(group).toBeDefined();
    const slugs =
      group && group.kind === "group" ? group.items.map((i) => i.slug) : [];
    expect(slugs).toContain("meetings");
  });
});

/**
 * 배포·운영과 서비스마감이 같은 목록을 범위로 나눠 본다.
 */
describe("배포·운영 메뉴", () => {
  it("사이드바에 있다", () => {
    expect(allItems.find((i) => i.slug === "deploy")?.label).toBe("배포 · 운영");
  });

  it("서비스마감 바로 위다 — 진행중 다음이 마감이다", () => {
    const group = sidebarSections
      .flatMap((s) => s.entries)
      .find(
        (e) =>
          e.kind === "group" && e.items.some((i) => i.slug === "closing"),
      );
    const slugs =
      group && group.kind === "group" ? group.items.map((i) => i.slug) : [];
    expect(slugs.indexOf("deploy")).toBe(slugs.indexOf("closing") - 1);
  });
});
