import { describe, it, expect } from "vitest";
import { sidebarSections } from "../../_data";
import { PAGE_META } from "../page-meta-config";
import { resolvePageMeta } from "../page-meta-derive";
import { ADMIN_ONLY_MENU_SLUGS } from "../sidebar-helpers";

const allItems = sidebarSections.flatMap((s) =>
  s.entries.flatMap((e) => (e.kind === "item" ? [e] : e.items)),
);

/**
 * 우편물 메뉴.
 *
 * 등기발송 영수증을 A4에 풀칠하고 등기번호를 손으로 엑셀에 옮겨 적던 일을
 * 화면으로 옮긴다. 자료보관 아래 두는 이유는 영수증이 곧 보관 자료이기 때문이다.
 */
describe("우편물 메뉴 등록", () => {
  it("slug postal이 사이드바에 있다", () => {
    const item = allItems.find((i) => i.slug === "postal");
    expect(item).toBeDefined();
    expect(item?.label).toBe("우편물");
  });

  it("자료보관 그룹에 있다", () => {
    const group = sidebarSections
      .flatMap((s) => s.entries)
      .find((e) => e.kind === "group" && e.label === "자료보관");
    expect(group).toBeDefined();
    const slugs =
      group && group.kind === "group" ? group.items.map((i) => i.slug) : [];
    expect(slugs).toContain("postal");
  });

  it("전원 열람이다 — 발송은 운영부 공동 업무다", () => {
    // adminOnly 플래그가 아니라 실제 게이트를 본다. 플래그만 보면 진짜 문이
    // 닫혀 있어도 통과한다(에이전트 메뉴에서 한 번 겪은 함정).
    expect([...ADMIN_ONLY_MENU_SLUGS]).not.toContain("postal");
  });

  it("페이지 헤더가 등록돼 있다", () => {
    // 사이드바 label로 떨어지는 fallback이 아니라 명시 등록인지 본다.
    expect(PAGE_META.postal).toBeDefined();
    const item = allItems.find((i) => i.slug === "postal");
    expect(item?.pattern).toBeDefined();
    const config = resolvePageMeta(
      "postal",
      item as Parameters<typeof resolvePageMeta>[1],
      0,
    );
    expect(config.headline.title).toBe("우편물");
    expect(config.headline.accent).toBe("자료보관");
  });
});
