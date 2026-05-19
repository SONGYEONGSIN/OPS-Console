import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";

/**
 * /dashboard/my-todo — 2 탭 재설계 (Weekly Planner + Project Gantt).
 *
 * 본인 only RLS — TEST_USER 본인이 created_by이므로 자기 todo/project 작성·편집·삭제 가능.
 * 다른 사용자 데이터는 RLS로 차단.
 *
 * afterEach: admin reset + '[E2E]' 접두사 cleanup (todos + projects 둘 다).
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

function cleanupTestData() {
  execSync("node scripts/cleanup-test-todos.mjs", { stdio: "pipe" });
  execSync("node scripts/cleanup-test-projects.mjs", { stdio: "pipe" });
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

test.describe("/dashboard/my-todo — 2 탭 재설계", () => {
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
    cleanupTestData();
  });

  test("admin: 기본 진입 시 weekly 탭 active + 7일 주 그리드 렌더", async ({
    page,
  }) => {
    togglePermission("admin");
    await signInAndGoto(page, "/dashboard/my-todo");

    // 탭 두 개 노출 + weekly active
    const weeklyTab = page.getByRole("tab", { name: "주요업무" });
    const projectTab = page.getByRole("tab", { name: "프로젝트" });
    await expect(weeklyTab).toBeVisible();
    await expect(projectTab).toBeVisible();
    await expect(weeklyTab).toHaveAttribute("aria-current", "page");

    // 요일 헤더 7개
    for (const wd of ["월", "화", "수", "목", "금", "토", "일"]) {
      await expect(page.getByText(wd, { exact: true })).toBeVisible();
    }

    // + 새 할 일 버튼 노출
    await expect(
      page.getByRole("button", { name: /\+ 새 할 일/ }),
    ).toBeVisible();
  });

  test("admin: 프로젝트 탭 클릭 → URL ?tab=project + project ListPattern 렌더", async ({
    page,
  }) => {
    togglePermission("admin");
    await signInAndGoto(page, "/dashboard/my-todo");

    await page.getByRole("tab", { name: "프로젝트" }).click();
    await expect(page).toHaveURL(/\?tab=project/);

    // + 새 프로젝트 버튼 노출
    await expect(
      page.getByRole("button", { name: /\+ 새 프로젝트/ }),
    ).toBeVisible();
  });

  test("viewer: 작성 버튼 hide (weekly + project 둘 다)", async ({ page }) => {
    togglePermission("viewer");
    toggleMenus(["my-todo"]);
    await signInAndGoto(page, "/dashboard/my-todo");

    // weekly 탭 — + 새 할 일 hidden
    await expect(
      page.getByRole("button", { name: /\+ 새 할 일/ }),
    ).toHaveCount(0);

    // project 탭으로 이동 — + 새 프로젝트 hidden
    await page.getByRole("tab", { name: "프로젝트" }).click();
    await expect(page).toHaveURL(/\?tab=project/);
    await expect(
      page.getByRole("button", { name: /\+ 새 프로젝트/ }),
    ).toHaveCount(0);
  });
});
