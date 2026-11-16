import { describe, it, expect } from "vitest";
import { sidebarSections } from "../../_data";
import { PAGE_META } from "../page-meta-config";
import {
  ADMIN_ONLY_MENU_SLUGS,
  DESIGNATED_ONLY_MENU_SLUGS,
} from "../sidebar-helpers";

const allItems = sidebarSections.flatMap((s) =>
  s.entries.flatMap((e) => (e.kind === "item" ? [e] : e.items)),
);
const group = (label: string) => {
  const g = sidebarSections
    .flatMap((s) => s.entries)
    .find((e) => e.kind === "group" && e.label === label);
  if (!g || g.kind !== "group") throw new Error(`묶음 없음: ${label}`);
  return g;
};

describe("주간업무보고 메뉴 등록", () => {
  it("'분석 & 보고' 묶음에 주간업무보고(ops-weekly)", () => {
    const g = group("분석 & 보고");
    expect(g.items.find((i) => i.slug === "ops-weekly")?.label).toBe(
      "주간업무보고",
    );
  });

  it("운영부 전원이 본다 — admin 전용·지정자 전용이 아니다", () => {
    expect(ADMIN_ONLY_MENU_SLUGS.has("ops-weekly")).toBe(false);
    expect(DESIGNATED_ONLY_MENU_SLUGS.has("ops-weekly")).toBe(false);
    const item = allItems.find((i) => i.slug === "ops-weekly");
    expect(item && "adminOnly" in item && item.adminOnly).toBeFalsy();
  });

  it("자동화 잡 id weekly-report 와 겹치지 않는다", () => {
    expect(allItems.some((i) => i.slug === "weekly-report")).toBe(false);
  });

  it("페이지 메타", () => {
    expect(PAGE_META["ops-weekly"]?.headline.title).toBe("주간업무보고");
  });
});
