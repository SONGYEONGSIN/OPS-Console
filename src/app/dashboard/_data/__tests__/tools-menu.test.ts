import { describe, it, expect } from "vitest";
import { sidebarSections } from "../../_data";
import { PAGE_META } from "../page-meta-config";
import { ADMIN_ONLY_MENU_SLUGS } from "../sidebar-helpers";

const allItems = sidebarSections.flatMap((s) =>
  s.entries.flatMap((e) => (e.kind === "item" ? [e] : e.items)),
);

describe("도구 메뉴 등록", () => {
  it("slug tools가 사이드바에 있다", () => {
    const item = allItems.find((i) => i.slug === "tools");
    expect(item?.label).toBe("도구");
  });

  it("에이전트 바로 아래다", () => {
    const group = sidebarSections
      .flatMap((s) => s.entries)
      .find((e) => e.kind === "group" && e.label === "AI & 자동화");
    const slugs =
      group && group.kind === "group" ? group.items.map((i) => i.slug) : [];
    expect(slugs.indexOf("tools")).toBe(slugs.indexOf("agents") + 1);
  });

  it("admin만 본다 — 개발 환경 설정이지 운영 업무가 아니다", () => {
    expect(ADMIN_ONLY_MENU_SLUGS.has("tools")).toBe(true);
  });

  it("페이지 메타가 등록되어 있다", () => {
    expect(PAGE_META.tools?.headline.title).toBe("도구");
  });
});
