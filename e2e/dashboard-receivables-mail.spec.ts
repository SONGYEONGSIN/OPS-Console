import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";

/**
 * /dashboard/receivables — 인스펙터의 독려 메일 발송 (admin only).
 *
 * 흐름: 미수채권 행 클릭 → 인스펙터 열림 → '독려 메일 발송' 버튼 클릭
 *  → (같은 이메일 다른 청구건이 있으면) 단건/묶음 선택 → 미리보기 → Dry-run 발송 → 결과
 *
 * MAIL_DRY_RUN=true 환경에서만 실행 (실발송 위험 회피).
 */

const TEST_EMAIL = process.env.TEST_USER_EMAIL!;

function togglePermission(permission: "admin" | "member" | "viewer") {
  execSync(
    `TARGET_EMAIL='${TEST_EMAIL}' PERMISSION=${permission} node scripts/toggle-permission.mjs`,
    { stdio: "pipe" },
  );
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

async function openFirstRowInspector(page: import("@playwright/test").Page) {
  // ListPattern은 tbody > tr 형태로 행 렌더. 첫 데이터 행 클릭.
  const firstRow = page.locator("tbody tr").first();
  await expect(firstRow).toBeVisible();
  await firstRow.click();
}

test.describe("/dashboard/receivables — 인스펙터 독려 메일 발송", () => {
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    "TEST_USER 미설정",
  );
  test.skip(
    process.env.MAIL_DRY_RUN === "false",
    "MAIL_DRY_RUN=false 면 실발송 위험으로 스킵",
  );

  test.afterEach(async () => {
    togglePermission("admin");
  });

  test("admin: 행 클릭 → 인스펙터에서 '독려 메일 발송' 버튼 노출", async ({
    page,
  }) => {
    togglePermission("admin");
    await signInAndGoto(page, "/dashboard/receivables");
    await openFirstRowInspector(page);

    const trigger = page.getByTestId("inspector-send-mail");
    await expect(trigger).toBeVisible();
  });

  test("viewer: 인스펙터에 발송 버튼 비가시", async ({ page }) => {
    togglePermission("viewer");
    await signInAndGoto(page, "/dashboard/receivables");
    await openFirstRowInspector(page);

    await expect(page.getByTestId("inspector-send-mail")).toHaveCount(0);
  });

  test("admin: 버튼 클릭 → 모달 표시 (단건 또는 묶음 흐름 중 하나)", async ({
    page,
  }) => {
    togglePermission("admin");
    await signInAndGoto(page, "/dashboard/receivables");
    await openFirstRowInspector(page);

    const trigger = page.getByTestId("inspector-send-mail");
    test.skip(
      (await trigger.count()) === 0,
      "행에 학교담당자 이메일이 없어 버튼 자체가 안 노출됨",
    );
    await trigger.click();

    await expect(page.getByRole("dialog")).toBeVisible();
    // select-scope (묶음 후보 있음) 또는 preview (단건) 중 하나
    const scope = page.getByTestId("select-scope");
    const preview = page.getByTestId("preview");
    const sendError = page.getByTestId("send-error");
    await expect(scope.or(preview).or(sendError)).toBeVisible({ timeout: 15000 });
  });
});
