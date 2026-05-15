import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";

/**
 * /dashboard/services — 권한 기반 UI 가드 회귀 검증.
 *
 * 서버 액션 `actions.ts:isOperator()`는 admin/member만 허용.
 * page.tsx의 canCreate/readOnly도 같은 조건을 따라야 viewer 회귀 방지.
 *
 * afterEach에서 admin + 빈 배열로 reset.
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

async function signInAndGotoServices(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/);
  await page.goto("/dashboard/services");
  await page.waitForLoadState("networkidle");
}

test.describe("/dashboard/services — 권한 가드", () => {
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    "TEST_USER 미설정",
  );

  test.afterEach(async () => {
    togglePermission("admin");
    toggleMenus([]);
  });

  test("admin: + 신규 서비스 버튼 노출", async ({ page }) => {
    togglePermission("admin");
    toggleMenus([]);
    await signInAndGotoServices(page);
    await expect(
      page.getByRole("button", { name: /\+ 신규 서비스/ }),
    ).toBeVisible();
  });

  test("viewer: services 진입 가능하나 + 신규 서비스 버튼 미노출", async ({
    page,
  }) => {
    togglePermission("viewer");
    toggleMenus(["services"]);
    await signInAndGotoServices(page);
    // 페이지 자체는 노출 (viewer는 read-only 조회 허용)
    await expect(page.getByText(/서비스/).first()).toBeVisible();
    // 신규 등록 버튼 미노출
    await expect(
      page.getByRole("button", { name: /\+ 신규 서비스/ }),
    ).toHaveCount(0);
  });
});
