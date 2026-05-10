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

  test("admin: 시드 read + 새 todo 작성 → optimistic", async ({ page }) => {
    togglePermission("admin");
    await signInAndGoto(page, "/dashboard/my-todo");

    // 시드 read — TEST_USER가 송영석이라는 가정 하에. 다른 계정이면 시드 보이지 않음
    // (본인 only RLS). 그래도 신규 작성·완료 토글은 동작해야 한다.
    await expect(
      page.getByRole("button", { name: /\+ 새 todo/ }),
    ).toBeVisible();

    await page.getByRole("button", { name: /\+ 새 todo/ }).click();
    await page.getByLabel("제목").fill("[E2E] 테스트 todo");
    await page.getByLabel("내용").fill("e2e 작성");
    await page.getByRole("button", { name: "저장" }).click();

    // optimistic — 테이블에 즉시 반영
    await expect(page.getByText("[E2E] 테스트 todo")).toBeVisible();
  });

  test("admin: 작성한 todo 체크박스 토글 → done 시각 반영", async ({ page }) => {
    togglePermission("admin");
    await signInAndGoto(page, "/dashboard/my-todo");

    // 작성
    await page.getByRole("button", { name: /\+ 새 todo/ }).click();
    await page.getByLabel("제목").fill("[E2E] 토글 테스트");
    await page.getByRole("button", { name: "저장" }).click();
    const newRow = page.getByText("[E2E] 토글 테스트");
    await expect(newRow).toBeVisible();

    // 해당 행의 체크박스 토글
    const checkbox = page.getByLabel(/\[E2E\] 토글 테스트 완료 토글/);
    await checkbox.check();
    await expect(checkbox).toBeChecked();

    // 행이 line-through opacity 표시 (CSS class 검증)
    const row = newRow.locator("xpath=ancestor::tr");
    await expect(row).toHaveClass(/line-through/);
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
