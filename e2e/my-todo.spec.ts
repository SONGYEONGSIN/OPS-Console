import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";

/**
 * /dashboard/my-todo — todos DB 연동 검증.
 *
 * 본인 only RLS — TEST_USER 본인이 created_by이므로 자기 todo 작성·완료 토글·삭제 가능.
 * 다른 사용자 todo는 RLS로 차단되어 list에 안 나타남(시드는 송영석 본인 todo만 있음).
 *
 * afterEach: admin reset + '[E2E]' 접두사 cleanup.
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

function cleanupTestTodos() {
  execSync("node scripts/cleanup-test-todos.mjs", { stdio: "pipe" });
}

async function signInAndGoto(
  page: import("@playwright/test").Page,
  path: string,
) {
  await page.goto("/login");
  await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/dashboard$/);
  await page.goto(path);
}

test.describe("/dashboard/my-todo — 본인 todo 흐름", () => {
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    "TEST_USER 미설정",
  );
  test.skip(
    ({ viewport }) => !!viewport && viewport.width < 1024,
    "데스크탑 한정",
  );

  test.afterEach(async () => {
    togglePermission("admin");
    toggleMenus([]);
    cleanupTestTodos();
  });

  test("viewer: 작성 버튼 hide", async ({ page }) => {
    togglePermission("viewer");
    toggleMenus(["my-todo"]);
    await signInAndGoto(page, "/dashboard/my-todo");

    await expect(
      page.getByRole("button", { name: /\+ 새 todo/ }),
    ).toHaveCount(0);
  });
});
