import { describe, it, expect } from "vitest";
import { sidebarSections } from "../../_data";
import { PAGE_META } from "../page-meta-config";
import { resolvePageMeta } from "../page-meta-derive";
import { ADMIN_ONLY_MENU_SLUGS } from "../sidebar-helpers";

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
    expect(item).toBeDefined();
    expect(item?.adminOnly).toBeFalsy();
    expect(ADMIN_ONLY_MENU_SLUGS.has("agents")).toBe(false);
  });

  it("페이지 메타가 등록되어 있다", () => {
    const entry = PAGE_META.agents;
    expect(entry).toBeDefined();
    expect(entry?.headline.title).toBe("에이전트");
  });

  it("헤더 메타에 위젯/실시간 스트림이 없다 — v1은 정적 화면이다", () => {
    const item = allItems.find((i) => i.slug === "agents");
    expect(item).toBeDefined();
    if (!item) return;
    expect(item.pattern).toBe("list");
    if (!item.pattern) return;
    const resolved = resolvePageMeta("agents", {
      ...item,
      pattern: item.pattern,
    });
    const labels = (resolved.meta ?? []).map((m) => m.label);
    expect(labels.some((l) => l.includes("실시간 스트림"))).toBe(false);
    expect(labels.some((l) => l.includes("위젯"))).toBe(false);
  });
});
