import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PAGE_META } from "../../_data/page-meta-config";
import {
  ADMIN_ONLY_MENU_SLUGS,
  getAllMenuSlugs,
} from "../../_data/sidebar-helpers";

/**
 * **결정하는 화면을 결정하는 자리에 둔다**(설계 2026-09-21 §5).
 *
 * `work-assignment` 메뉴는 PR #788 부터 사이드바에 등록돼 있었는데 라우트가 없어
 * 404 였고, 그 사이 배분현황·제안이 전원 열람 메뉴인 총괄장에 얹혀 **탭마다 권한을
 * 판정**하고 있었다. 판정이 두 벌이면 한쪽만 고쳐지는 날이 온다.
 *
 * 원문으로 고정하는 이유: 두 라우트가 같은 탭을 그리는지는 **렌더 테스트로는 안
 * 잡힌다** — 양쪽 다 정상으로 보인다. 어느 쪽이 사실인지 매번 물어야 하는 상태가
 * 되고, 그건 화면이 아니라 구조의 문제다.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/**
 * **주석을 지우고 대조한다.** 안 지우면 *왜 그렇게 안 했는지* 적어 둔 주석이
 * 금지 패턴에 걸려, 설명을 지워야 초록이 되는 테스트가 된다. 거꾸로 주석 처리된
 * 정의를 살아 있는 코드로 읽고 초록이 난 적도 있다(`rpc.test.ts` 의 교훈).
 */
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
const ASSIGNMENTS = "src/app/dashboard/assignments/page.tsx";
const WORK_ASSIGNMENT = "src/app/dashboard/work-assignment/page.tsx";

describe("관리 > 업무배정 라우트", () => {
  it("메뉴가 사이드바와 admin 집합 양쪽에 등재돼 있다", () => {
    // 한쪽에만 있으면 메뉴는 보이는데 못 들어가거나, 그 반대가 된다.
    expect(getAllMenuSlugs()).toContain("work-assignment");
    expect(ADMIN_ONLY_MENU_SLUGS.has("work-assignment")).toBe(true);
  });

  it("페이지 메타가 있다 — 없으면 사이드바 라벨 fallback 으로 떨어진다", () => {
    expect(PAGE_META["work-assignment"]).toBeDefined();
    expect(PAGE_META["work-assignment"].headline.title).toBe("업무배정");
  });

  it('라우트가 `requireMenu("work-assignment")` 하나로 가드한다', () => {
    /*
     * 페이지가 스스로 `permission === "admin"` 을 판정하면 안 된다 — `canViewMenu`
     * 와 두 벌이 되어, 나중에 한쪽만 바뀌면 메뉴는 숨었는데 주소로는 열리거나
     * 그 반대가 된다. 가드는 라우트 하나다.
     */
    const src = code(WORK_ASSIGNMENT);
    expect(src).toMatch(/const slug = "work-assignment"/);
    expect(src).toMatch(/requireMenu\(slug\)/);
    // 자체 판정이 없다 — 있으면 `canViewMenu` 와 두 벌이 된다.
    expect(src).not.toMatch(/permission\s*[=!]==?\s*["']admin["']/);
  });

  it("총괄장에서 배분현황·제안 탭이 빠졌다 — 같은 화면이 두 곳에 있지 않다", () => {
    const src = code(ASSIGNMENTS);
    expect(src).not.toMatch(/ADMIN_TABS/);
    expect(src).not.toMatch(/tab=workload/);
    expect(src).not.toMatch(/tab=proposals/);
  });

  it("총괄장이 배분현황 데이터를 더 이상 읽지 않는다", () => {
    // 탭만 지우고 조회가 남으면 아무도 안 보는 표를 위해 매 렌더에 세 번 조회한다.
    const src = code(ASSIGNMENTS);
    expect(src).not.toMatch(/loadWorkloadSources|buildWorkload|listProposals/);
  });

  it("옮겨 간 화면 세 개가 새 라우트 밑에 있다", () => {
    for (const f of [
      "src/app/dashboard/work-assignment/WorkloadTable.tsx",
      "src/app/dashboard/work-assignment/ProposalPanel.tsx",
      "src/app/dashboard/work-assignment/ProposalDecision.tsx",
    ]) {
      expect(() => read(f)).not.toThrow();
    }
  });
});
