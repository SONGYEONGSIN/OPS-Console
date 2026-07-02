import { describe, it, expect } from "vitest";
import {
  findSidebarBreadcrumb,
  findSidebarSiblings,
  findSidebarParentGroup,
  findSidebarLabel,
} from "../sidebar-helpers";
import { sidebarSections } from "../../_data";

describe("findSidebarBreadcrumb", () => {
  it("그룹 안 메뉴 — section + group + item 3단", () => {
    const crumbs = findSidebarBreadcrumb("/dashboard/services");
    expect(crumbs).toHaveLength(3);
    expect(crumbs[0].label).toBe("서비스 그룹");
    expect(crumbs[1].label).toBe("서비스사이클");
    expect(crumbs[2].label).toBe("서비스목록");
  });

  it("section 직속 item — section + item 2단", () => {
    const crumbs = findSidebarBreadcrumb("/dashboard/my-todo");
    expect(crumbs).toHaveLength(2);
    expect(crumbs[0].label).toBe("개요");
    expect(crumbs[1].label).toBe("오늘 할 일");
  });

  it("매칭 안 되는 pathname — 빈 배열", () => {
    expect(findSidebarBreadcrumb("/dashboard/zzz-nonexistent")).toEqual([]);
  });
});

describe("findSidebarLabel", () => {
  it("그룹 안 메뉴 slug → 메뉴 label", () => {
    expect(findSidebarLabel(sidebarSections, "services")).toBe("서비스목록");
  });
  it("section 직속 item slug → 메뉴 label", () => {
    expect(findSidebarLabel(sidebarSections, "my-todo")).toBe("오늘 할 일");
  });
  it("매칭 안 되는 slug → slug 그대로 반환", () => {
    expect(findSidebarLabel(sidebarSections, "zzz-nope")).toBe("zzz-nope");
  });
});

describe("findSidebarSiblings", () => {
  it("그룹 안 메뉴 — 같은 그룹의 형제들 반환", () => {
    const sibs = findSidebarSiblings("/dashboard/services");
    expect(sibs.map((s) => s.label)).toEqual([
      "총괄장",
      "계약",
      "서비스목록",
      "개발 · 테스트",
      "배포 · 운영",
      "서비스마감",
      "전형료정산",
      "계산서발행",
      "미수채권",
    ]);
  });

  it("section 직속 item — 빈 배열 (형제 탭 미노출)", () => {
    expect(findSidebarSiblings("/dashboard/my-todo")).toEqual([]);
  });

  it("매칭 안 되는 pathname — 빈 배열", () => {
    expect(findSidebarSiblings("/dashboard/zzz-nonexistent")).toEqual([]);
  });
});

describe("findSidebarParentGroup", () => {
  it("group 안 item — group label 반환", () => {
    expect(findSidebarParentGroup("/dashboard/services")).toBe("서비스사이클");
    expect(findSidebarParentGroup("/dashboard/contacts")).toBe("고객응대");
  });

  it("section 직속 item — null 반환", () => {
    expect(findSidebarParentGroup("/dashboard/my-todo")).toBeNull();
    expect(findSidebarParentGroup("/dashboard/handover")).toBeNull();
  });

  it("매칭 안 되는 pathname — null", () => {
    expect(findSidebarParentGroup("/dashboard/zzz-nonexistent")).toBeNull();
  });
});
