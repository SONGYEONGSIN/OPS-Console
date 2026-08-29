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

  it("자동화실행 바로 위다 — 에이전트가 쓰는 것들을 함께 둔다", () => {
    // 예전엔 '에이전트 바로 아래'로 고정했었다. 에이전트가 그룹 맨 앞(관제탑)으로
    // 올라가면서 그 인접성은 깨졌고, 대신 도구·자동화실행이 붙어 있으면 된다.
    const group = sidebarSections
      .flatMap((s) => s.entries)
      .find((e) => e.kind === "group" && e.label === "AI & 자동화");
    const slugs =
      group && group.kind === "group" ? group.items.map((i) => i.slug) : [];
    expect(slugs.indexOf("tools")).toBe(slugs.indexOf("automations") - 1);
  });

  it("admin만 본다 — 개발 환경 설정이지 운영 업무가 아니다", () => {
    expect(ADMIN_ONLY_MENU_SLUGS.has("tools")).toBe(true);
  });

  it("페이지 메타가 등록되어 있다", () => {
    expect(PAGE_META.tools?.headline.title).toBe("도구");
  });
});
