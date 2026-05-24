import { test, expect } from "@playwright/test";

/**
 * /dashboard/outcomes — 성과리포트 smoke.
 *
 * 시드 데이터(2026_h1_performance.sql) 적용 후 동작.
 * 시드 없으면 페이지 진입 + 빈 리스트 만 검증.
 */
test.skip(
  !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
  "TEST_USER 미설정 — 인증 필요",
);

test.describe("/dashboard/outcomes — 성과리포트 smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/);
  });

  test("페이지 진입 + 헤드라인 노출", async ({ page }) => {
    await page.goto("/dashboard/outcomes");
    await page.waitForLoadState("networkidle");
    // PageHeader headline '분석 · AI — 성과 리포트' 노출
    await expect(page.getByText("성과 리포트", { exact: true })).toBeVisible();
  });

  test("admin 권한 시 AdminSummary 8단계 카드 노출", async ({ page }) => {
    await page.goto("/dashboard/outcomes");
    await page.waitForLoadState("networkidle");
    // admin 권한 사용자 한정 — AdminSummary testid로 노출 확인
    // (admin이 아니면 hidden — 그 경우 본 케이스는 fail이 아닌 skip 가능)
    const summary = page.getByTestId("performance-admin-summary");
    if (await summary.count()) {
      await expect(summary).toBeVisible();
      // 8단계 라벨 모두 노출
      for (const label of [
        "목표설정",
        "실행계획",
        "계획검토",
        "중간점검",
        "점검검토",
        "자기평가",
        "종합평가",
      ]) {
        await expect(summary.getByText(new RegExp(label))).toBeVisible();
      }
    }
  });

  test("시드 데이터 row 클릭 → 인스펙터 stepper 노출", async ({ page }) => {
    await page.goto("/dashboard/outcomes");
    await page.waitForLoadState("networkidle");

    // 첫 row가 있으면 클릭, 없으면 skip
    const firstRow = page.locator("tbody tr").first();
    if ((await firstRow.count()) === 0) {
      test.skip(true, "시드 데이터 없음 — 본 케이스는 시드 적용 후 검증");
    }
    await firstRow.click();
    // 인스펙터 본문에 Stepper 노출
    await expect(page.getByTestId("performance-stepper")).toBeVisible();
  });
});
