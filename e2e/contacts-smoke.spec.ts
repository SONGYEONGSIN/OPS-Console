import { test, expect } from "@playwright/test";

/**
 * /dashboard/contacts — URL 파라미터 SSR smoke.
 *
 * 실 DB row가 적어 total N 변화 검증은 어려움 → URL 보존 + 페이지 정상 렌더링 위주.
 * 권한 가드(viewer 신규 버튼 미노출)는 e2e/list-permission.spec.ts 에서 별도 검증.
 */
test.skip(
  !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
  "TEST_USER 미설정 — 인증 필요",
);

test.describe("/dashboard/contacts — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/);
  });

  async function gotoContacts(
    page: import("@playwright/test").Page,
    query = "",
  ) {
    await page.goto(`/dashboard/contacts${query}`);
    await page.waitForLoadState("networkidle");
  }

  test("baseline: 진입 + 헤드라인 노출", async ({ page }) => {
    await gotoContacts(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("q=대학 검색 시 URL 보존", async ({ page }) => {
    await gotoContacts(page, "?q=" + encodeURIComponent("대학"));
    await expect(page).toHaveURL(/q=/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("customerActive=재직 필터 시 URL 보존", async ({ page }) => {
    await gotoContacts(page, "?customerActive=" + encodeURIComponent("재직"));
    await expect(page).toHaveURL(/customerActive=/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("managementGrade=A 필터 시 URL 보존", async ({ page }) => {
    await gotoContacts(page, "?managementGrade=A");
    await expect(page).toHaveURL(/managementGrade=A/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("sort + page 파라미터 보존", async ({ page }) => {
    await gotoContacts(page, "?sort=customer_name_asc&page=1");
    await expect(page).toHaveURL(/sort=customer_name_asc/);
    await expect(page).toHaveURL(/page=1/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
