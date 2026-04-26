import { test, expect } from "@playwright/test";

test.describe("/forgot-password", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/forgot-password");
  });

  test("페이지 렌더 + 핵심 카피 노출", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "비밀번호 찾기", level: 2 })).toBeVisible();
    await expect(page.getByText("← 로그인으로 돌아가기")).toBeVisible();
  });

  test("빈 이메일 제출 시 zod 에러", async ({ page }) => {
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByText("이메일을 입력해주세요.")).toBeVisible();
  });

  test("이메일 형식 잘못되면 zod 에러", async ({ page }) => {
    await page.fill('input[name="email"]', "not-an-email");
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByText("이메일 형식이 올바르지 않습니다.")).toBeVisible();
  });

  test("정상 이메일 제출 시 info alert (TEST_USER 미설정 시 skip)", async ({ page }) => {
    test.skip(
      !process.env.TEST_USER_EMAIL,
      "TEST_USER_EMAIL 미설정 — 실제 Supabase 호출 필요"
    );
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
    await page.locator('form button[type="submit"]').click();
    await expect(
      page.getByText("재설정 링크를 발송했습니다. 메일함을 확인해주세요.")
    ).toBeVisible({ timeout: 10000 });
  });

  test("← 로그인으로 돌아가기 클릭 시 /login으로 이동", async ({ page }) => {
    await page.getByText("← 로그인으로 돌아가기").click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
