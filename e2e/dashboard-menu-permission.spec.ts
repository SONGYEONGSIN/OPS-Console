import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";

/**
 * /dashboard 사이드바 + 페이지 가드 — 사용자별 메뉴 권한(allowed_menus) UX 검증.
 *
 * 단일 TEST_USER + scripts/toggle-permission + toggle-allowed-menus 토글:
 * - admin (allowed_menus=[]): 모든 메뉴 자동 통과 (bypass)
 * - member (allowed_menus=일부): 부여된 slug만 사이드바 노출 + 직접 URL 차단
 *
 * afterEach에서 admin + 빈 배열로 reset → 다른 dashboard 테스트 영향 차단.
 */

const TEST_EMAIL = process.env.TEST_USER_EMAIL!;

function togglePermission(permission: "admin" | "member" | "viewer") {
  execSync(
    `TARGET_EMAIL='${TEST_EMAIL}' PERMISSION=${permission} node scripts/toggle-permission.mjs`,
    { stdio: "pipe" },
  );
}

function toggleMenus(menus: string[]) {
  execSync(
    `TARGET_EMAIL='${TEST_EMAIL}' MENUS='${menus.join(",")}' node scripts/toggle-allowed-menus.mjs`,
    { stdio: "pipe" },
  );
}

async function signInAndGotoDashboard(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/dashboard$/);
}

test.describe("/dashboard — 메뉴 접근 권한 (allowed_menus)", () => {
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    "TEST_USER_EMAIL/PASSWORD 미설정",
  );
  test.skip(
    ({ viewport }) => !!viewport && viewport.width < 1024,
    "데스크탑(≥1024) 한정 — 모바일 사이드바 드로어는 별도",
  );

  test.afterEach(async () => {
    togglePermission("admin");
    toggleMenus([]);
  });

  test("admin: 사이드바에 admin 전용 메뉴(조직·권한 / 시스템 설정) 노출", async ({
    page,
  }) => {
    togglePermission("admin");
    toggleMenus([]);
    await signInAndGotoDashboard(page);

    const nav = page.locator("#sidebar");
    await expect(nav.getByText("조직 · 권한")).toBeVisible();
    await expect(nav.getByText("시스템 설정")).toBeVisible();
  });

  test("admin: /dashboard/team 직접 URL 통과", async ({ page }) => {
    togglePermission("admin");
    toggleMenus([]);
    await signInAndGotoDashboard(page);

    await page.goto("/dashboard/team");
    await expect(page).toHaveURL(/\/dashboard\/team$/);
  });

  test("member: allowed_menus만 사이드바에 노출 + 다른 메뉴 hide", async ({
    page,
  }) => {
    togglePermission("member");
    toggleMenus(["alerts", "feedback"]);
    await signInAndGotoDashboard(page);

    const nav = page.locator("#sidebar");
    await expect(nav.getByText("새 알림")).toBeVisible();
    await expect(nav.getByText("개선 요청")).toBeVisible();
    await expect(nav.getByText("조직 · 권한")).toHaveCount(0);
    await expect(nav.getByText("시스템 설정")).toHaveCount(0);
  });

  test("member: 권한 없는 /dashboard/team 직접 URL → /dashboard로 redirect", async ({
    page,
  }) => {
    togglePermission("member");
    toggleMenus(["alerts"]);
    await signInAndGotoDashboard(page);

    await page.goto("/dashboard/team");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
