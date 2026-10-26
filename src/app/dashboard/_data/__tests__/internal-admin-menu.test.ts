import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sidebarSections } from "../../_data";
import {
  ADMIN_ONLY_MENU_SLUGS,
  DESIGNATED_ONLY_MENU_SLUGS,
  getDefaultMemberMenus,
} from "../sidebar-helpers";
import { PAGE_META } from "../page-meta-config";

/** 주석을 지우고 대조한다 — 주석 처리된 정의를 살아 있는 코드로 읽지 않으려고. */
const code = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])--.*$/gm, "$1");

describe("내부관리자 메뉴 — 지정자 전용", () => {
  it("사이드바 프로젝트 그룹에 있다", () => {
    const group = sidebarSections
      .flatMap((s) => s.entries)
      .find((e) => e.kind === "group" && e.label === "프로젝트");
    const slugs =
      group && group.kind === "group" ? group.items.map((i) => i.slug) : [];
    expect(slugs).toContain("internal-admin");
  });

  it("지정자 전용이고 admin 전용이 아니다", () => {
    expect(DESIGNATED_ONLY_MENU_SLUGS.has("internal-admin")).toBe(true);
    expect(ADMIN_ONLY_MENU_SLUGS.has("internal-admin")).toBe(false);
  });

  it("두 집합은 겹치지 않는다", () => {
    expect(
      [...DESIGNATED_ONLY_MENU_SLUGS].filter((s) => ADMIN_ONLY_MENU_SLUGS.has(s)),
    ).toEqual([]);
  });

  it("신규 member 기본 메뉴에 들어가지 않는다", () => {
    expect(getDefaultMemberMenus()).not.toContain("internal-admin");
  });

  it("페이지 메타가 있다 — 없으면 사이드바 라벨 fallback 으로 떨어진다", () => {
    expect(PAGE_META["internal-admin"]).toMatchObject({
      headline: { accent: "프로젝트", title: "내부관리자" },
    });
  });

  it("기존 부여를 걷는 마이그레이션이 있다", () => {
    const sql = code("supabase/migrations/20261026_internal_admin_menu_revoke.sql");
    expect(sql).toMatch(/array_remove\(\s*allowed_menus\s*,\s*'internal-admin'\s*\)/);
  });
});
