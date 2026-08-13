import { describe, it, expect } from "vitest";
import { sidebarSections } from "../../_data";
import { PAGE_META } from "../page-meta-config";

const allItems = sidebarSections.flatMap((s) =>
  s.entries.flatMap((e) => (e.kind === "item" ? [e] : e.items)),
);

describe("에이전트 메뉴 등록", () => {
  it("slug agents가 사이드바에 있다", () => {
    const item = allItems.find((i) => i.slug === "agents");
    expect(item).toBeDefined();
    expect(item?.label).toBe("에이전트");
  });

  it("자동화실행 바로 위에 있다", () => {
    const group = sidebarSections
      .flatMap((s) => s.entries)
      .find((e) => e.kind === "group" && e.label === "AI & 자동화");
    expect(group).toBeDefined();
    const slugs =
      group && group.kind === "group" ? group.items.map((i) => i.slug) : [];
    expect(slugs.indexOf("agents")).toBe(slugs.indexOf("automations") - 1);
  });

  it("전원 열람이다 — adminOnly가 아니다", () => {
    const item = allItems.find((i) => i.slug === "agents");
    expect(item?.adminOnly).toBeFalsy();
  });

  it("페이지 메타가 등록되어 있다", () => {
    const entry = PAGE_META.agents;
    expect(entry).toBeDefined();
    expect(entry?.headline.title).toBe("에이전트");
  });
});
