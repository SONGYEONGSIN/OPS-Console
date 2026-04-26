import { test, expect } from "@playwright/test";

test.describe("/reset-password", () => {
  test("token 없이 직접 진입 시 가드 안내", async ({ page }) => {
    await page.goto("/reset-password");
    // 비로그인 컨텍스트는 middleware가 통과(PUBLIC_PATHS) → 페이지 마운트 후 getUser() = no-session
    await expect(page.getByText("잘못된 접근입니다")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("비밀번호 찾기로 가기 →")).toBeVisible();
  });

  test("가드 통과 후 강도 인디케이터 동작 (TEST_USER 미설정 시 skip)", async ({ page }) => {
    test.skip(
      !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
      "TEST_USER 미설정 — 일반 로그인으로 user 생성 후 reset-password 진입"
    );
    // 일반 로그인으로 user 만들기 (이미 로그인된 사용자 진입은 그대로 허용 — 가드 통과)
    await page.goto("/login");
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard$/);

    await page.goto("/reset-password");
    await expect(page.getByText("새 비밀번호 설정")).toBeVisible({ timeout: 5000 });
    await page.locator('input[name="password"]').fill("Aa1!aaaa");
    await expect(page.getByText("영문 대문자 포함")).toHaveClass(/text-sage/);
    await expect(page.getByText("8자 이상")).toHaveClass(/text-sage/);
  });
});
