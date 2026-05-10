import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";

/**
 * /dashboard/schedule — schedule_events DB 연동 검증.
 *
 * 단일 TEST_USER + scripts/toggle-permission 토글:
 * - admin: 모든 일정 CRUD (canCreate, 시드 read, 신규 작성 optimistic)
 * - member: canCreate 유지 (본인/assignee 일정만 RLS 통과)
 * - viewer: 작성 버튼 hide
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

function cleanupTestSchedule() {
  execSync("node scripts/cleanup-test-schedule.mjs", { stdio: "pipe" });
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

test.describe("/dashboard/schedule — admin 흐름", () => {
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
    cleanupTestSchedule();
  });

  test("admin: 시드 3건 read + 새 일정 작성 폼 + 저장 → optimistic", async ({
    page,
  }) => {
    togglePermission("admin");
    await signInAndGoto(page, "/dashboard/schedule");

    // 시드 read (회귀 방어)
    await expect(page.getByText("운영2팀 주간 시프트")).toBeVisible();
    await expect(page.getByText("주간 운영 회의")).toBeVisible();
    await expect(page.getByText("김지나 사원 휴가")).toBeVisible();

    // 신규 작성 버튼 노출
    await expect(
      page.getByRole("button", { name: /\+ 새 일정/ }),
    ).toBeVisible();

    // 폼 채우고 저장
    await page.getByRole("button", { name: /\+ 새 일정/ }).click();
    await page.getByLabel("제목").fill("[E2E] 테스트 일정");
    await page.getByLabel("설명").fill("e2e 작성");
    await page.getByLabel("저장").or(page.getByRole("button", { name: "저장" })).click();

    // optimistic UI — 테이블에 즉시 반영
    await expect(page.getByText("[E2E] 테스트 일정")).toBeVisible();
  });
});

test.describe("/dashboard/schedule — member 흐름", () => {
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
    cleanupTestSchedule();
  });

  test("member: 시드 read + 작성 버튼 노출 (본인 일정 가능)", async ({ page }) => {
    togglePermission("member");
    toggleMenus(["schedule"]);
    await signInAndGoto(page, "/dashboard/schedule");

    // 시드 read
    await expect(page.getByText("운영2팀 주간 시프트")).toBeVisible();

    // canCreate=true (본인 created_by이면 RLS 통과)
    await expect(
      page.getByRole("button", { name: /\+ 새 일정/ }),
    ).toBeVisible();
  });
});

test.describe("/dashboard/schedule — viewer 차단", () => {
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
    cleanupTestSchedule();
  });

  test("viewer: 시드 read 가능 / 작성 버튼 hide", async ({ page }) => {
    togglePermission("viewer");
    toggleMenus(["schedule"]);
    await signInAndGoto(page, "/dashboard/schedule");

    // 시드 read OK
    await expect(page.getByText("운영2팀 주간 시프트")).toBeVisible();

    // 작성 버튼 hide
    await expect(
      page.getByRole("button", { name: /\+ 새 일정/ }),
    ).toHaveCount(0);
  });
});
