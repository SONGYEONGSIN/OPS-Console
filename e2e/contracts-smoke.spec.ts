import { test, expect } from "@playwright/test";

/**
 * /dashboard/contracts — SharePoint Excel 기반 read-only 회귀 smoke.
 *
 * scope: 기본 진입 / 시트 필터 / 검색 / ScopeChips / read-only 가드.
 * SharePoint workbook fetch에 의존하므로 navigation timeout을 넉넉히 둠.
 */
test.skip(
  !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
  "TEST_USER 미설정 — 인증 필요",
);

test.describe("/dashboard/contracts — smoke", () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(60_000);
    await page.goto("/login");
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/);
  });

  async function gotoContracts(
    page: import("@playwright/test").Page,
    query = "",
  ) {
    await page.goto(`/dashboard/contracts${query}`);
    await page.waitForLoadState("networkidle");
  }

  test("baseline: 진입 + ScopeChips '전체' 노출", async ({ page }) => {
    await gotoContracts(page);
    await expect(page.getByRole("button", { name: "전체" })).toBeVisible();
  });

  test("read-only: '+ 신규 계약' 버튼 미노출 (SharePoint 정책)", async ({
    page,
  }) => {
    await gotoContracts(page);
    await expect(
      page.getByRole("button", { name: /\+ 신규 계약/ }),
    ).toHaveCount(0);
  });

  test("sheet=4년제 적용 시 URL 보존 + ScopeChips 노출 유지", async ({
    page,
  }) => {
    await gotoContracts(page, "?sheet=" + encodeURIComponent("4년제"));
    await expect(page).toHaveURL(/sheet=/);
    await expect(page.getByRole("button", { name: "전체" })).toBeVisible();
  });

  test("q=대학 검색 시 URL 보존 + 페이지 정상", async ({ page }) => {
    await gotoContracts(page, "?q=" + encodeURIComponent("대학"));
    await expect(page).toHaveURL(/q=/);
    await expect(page.getByRole("button", { name: "전체" })).toBeVisible();
  });

  test("?mine=true 시 '내 계약' 칩이 active 상태", async ({ page }) => {
    await gotoContracts(page, "?mine=true");
    const mineChip = page.getByRole("button", { name: "내 계약" });
    await expect(mineChip).toHaveAttribute("aria-pressed", "true");
  });
});
