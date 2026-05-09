import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";

/**
 * /dashboard/team — 시스템 권한 (admin / member / viewer) UX 차이 검증.
 *
 * 단일 TEST_USER + scripts/toggle-permission.mjs로 DB 토글 (다중 계정 부담 회피).
 * - admin: "+ 신규 계정" 버튼 visible, row 클릭 → 편집 버튼 visible
 * - member/viewer: 신규 버튼 hidden, 편집 버튼 hidden (read-only)
 *
 * afterEach에서 admin으로 reset → 다른 dashboard 테스트 영향 차단.
 */

const TEST_EMAIL = process.env.TEST_USER_EMAIL!;

function togglePermission(permission: "admin" | "member" | "viewer") {
  execSync(
    `TARGET_EMAIL='${TEST_EMAIL}' PERMISSION=${permission} node scripts/toggle-permission.mjs`,
    { stdio: "pipe" },
  );
}

async function signInAndGotoTeam(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/dashboard$/);
  await page.goto("/dashboard/team");
}

test.describe("/dashboard/team — 시스템 권한 UX", () => {
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    "TEST_USER_EMAIL/PASSWORD 미설정",
  );
  test.skip(
    ({ viewport }) => !!viewport && viewport.width < 1024,
    "데스크탑 (≥1024) 한정 — 모바일 sidebar 드로어는 별도",
  );

  test.afterEach(async () => {
    // 다른 인증 의존 dashboard 테스트가 admin을 기대하므로 reset
    togglePermission("admin");
  });

  test("admin — '+ 신규 계정' 버튼 visible + 편집 버튼 visible", async ({
    page,
  }) => {
    togglePermission("admin");
    await signInAndGotoTeam(page);

    await expect(
      page.getByRole("button", { name: /\+ 신규 계정/ }),
    ).toBeVisible();

    // 임의 row 클릭 → 편집 버튼 보임
    await page.getByText("정윤나").first().click();
    await expect(page.getByRole("button", { name: /구성 편집/ })).toBeVisible();
  });

  test("member — 신규/편집 버튼 hidden (read-only)", async ({ page }) => {
    togglePermission("member");
    await signInAndGotoTeam(page);

    await expect(
      page.getByRole("button", { name: /\+ 신규 계정/ }),
    ).toHaveCount(0);

    await page.getByText("정윤나").first().click();
    await expect(page.getByRole("button", { name: /구성 편집/ })).toHaveCount(0);
  });

  test("viewer — 신규/편집 버튼 hidden (read-only)", async ({ page }) => {
    togglePermission("viewer");
    await signInAndGotoTeam(page);

    await expect(
      page.getByRole("button", { name: /\+ 신규 계정/ }),
    ).toHaveCount(0);

    await page.getByText("정윤나").first().click();
    await expect(page.getByRole("button", { name: /구성 편집/ })).toHaveCount(0);
  });

  test("admin — list view에 '관리자' 라벨 노출 (송영신 본인)", async ({
    page,
  }) => {
    togglePermission("admin");
    await signInAndGotoTeam(page);

    // permission 컬럼에 '관리자' 라벨이 최소 2개 노출 (admin 시드 = 부장 1 + 팀장 1)
    const adminBadges = page.locator("td", { hasText: /^관리자$/ });
    expect(await adminBadges.count()).toBeGreaterThanOrEqual(2);
    expect(await page.locator("td", { hasText: /^구성원$/ }).count()).toBeGreaterThanOrEqual(13);
  });
});
