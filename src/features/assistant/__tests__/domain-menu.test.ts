import { describe, it, expect } from "vitest";
import { DOMAIN_MENU_SLUG, visibleDomains } from "../domain-menu";
import { sidebarSections } from "@/app/dashboard/_data";

/**
 * 도메인 ↔ 사이드바 slug 매핑.
 *
 * 이 매핑이 틀리면 **조용히 통과한다.** `canViewMenu`는 admin 전용 목록에 없는
 * slug를 전부 허용하므로, 오타 난 slug(`incidnets`)도 "볼 수 있음"이 된다.
 * 그래서 slug가 사이드바에 실재하는지를 별도로 검사한다.
 *
 * 2026-08-18 현재 7개 도메인 중 admin 전용은 하나도 없다 — 즉 이 필터는 지금
 * 아무도 안 거른다. 그래도 두는 이유는 나중에 어느 도메인이 admin 전용이 될 때
 * 코드를 안 고쳐도 따라오게 하기 위해서다. 설계: 2026-08-18-assistant-tools-design.md §2
 */
const allSlugs = new Set(
  sidebarSections
    .flatMap((s) =>
      s.entries.flatMap((e) => (e.kind === "item" ? [e] : e.items)),
    )
    .map((i) => i.slug)
    .filter((s): s is string => Boolean(s)),
);

describe("DOMAIN_MENU_SLUG", () => {
  it("7개 도메인이 모두 매핑돼 있다", () => {
    expect(Object.keys(DOMAIN_MENU_SLUG).sort()).toEqual([
      "ai-tip",
      "backup",
      "contact",
      "handover",
      "incident",
      "knowledge",
      "service",
    ]);
  });

  it("매핑된 slug가 전부 사이드바에 실재한다", () => {
    // 오타 난 slug는 admin 전용 목록에 없어서 항상 '볼 수 있음'이 된다 — 여기서 잡는다.
    for (const [domain, slug] of Object.entries(DOMAIN_MENU_SLUG)) {
      expect(allSlugs, `${domain} → ${slug}`).toContain(slug);
    }
  });
});

describe("visibleDomains", () => {
  it("admin은 전부 본다", () => {
    expect(visibleDomains("admin").sort()).toEqual(
      Object.keys(DOMAIN_MENU_SLUG).sort(),
    );
  });

  it("member도 지금은 전부 본다 — admin 전용 도메인이 없다", () => {
    // 이 단언이 깨지는 날은 어느 도메인이 admin 전용이 된 날이다. 그때 설계를 다시 본다.
    expect(visibleDomains("member").sort()).toEqual(
      Object.keys(DOMAIN_MENU_SLUG).sort(),
    );
  });

  it("viewer는 아무것도 못 본다", () => {
    // 어시스턴트 자체가 viewer 403이다. 도구도 같은 선을 지킨다.
    expect(visibleDomains("viewer")).toEqual([]);
  });

  it("권한이 없으면 아무것도 못 본다", () => {
    expect(visibleDomains(null)).toEqual([]);
  });
});
