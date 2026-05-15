import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";

/**
 * viewer 권한 — admin 전용 메뉴(team / notices) 차단 회귀 검증.
 *
 * - viewer + 빈 allowedMenus → 직접 URL 접근 시 /dashboard 리다이렉트 (requireMenu)
 * - viewer + allowedMenus=[notices] → notices 진입 가능하나 admin 전용 '+ 새 공지' 버튼 미노출
 *
 * 기존 dashboard-menu-permission.spec.ts 는 member 케이스만 검증. viewer는 별도.
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

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/);
}

test.describe("viewer — admin 전용 메뉴 차단", () => {
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    "TEST_USER 미설정",
  );

  test.afterEach(async () => {
    togglePermission("admin");
    toggleMenus([]);
  });

  test("viewer + 빈 allowedMenus: /dashboard/team URL → /dashboard 리다이렉트", async ({
    page,
  }) => {
    togglePermission("viewer");
    toggleMenus([]);
    await signIn(page);
    await page.goto("/dashboard/team");
    await expect(page).toHaveURL(/\/dashboard\/?$/);
  });

  test("viewer + 빈 allowedMenus: /dashboard/notices URL → /dashboard 리다이렉트", async ({
    page,
  }) => {
    togglePermission("viewer");
    toggleMenus([]);
    await signIn(page);
    await page.goto("/dashboard/notices");
    await expect(page).toHaveURL(/\/dashboard\/?$/);
  });

  test("viewer + allowedMenus=[notices]: notices 진입 가능 + '+ 새 공지' 미노출", async ({
    page,
  }) => {
    togglePermission("viewer");
    toggleMenus(["notices"]);
    await signIn(page);
    await page.goto("/dashboard/notices");
    await expect(page).toHaveURL(/\/dashboard\/notices$/);
    await expect(
      page.getByRole("button", { name: /\+ 새 공지/ }),
    ).toHaveCount(0);
  });
});
