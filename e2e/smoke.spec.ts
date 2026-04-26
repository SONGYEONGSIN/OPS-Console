import { test, expect } from "@playwright/test";

/**
 * 기본 smoke — 라우트가 200 응답 + 콘솔 에러 0 + 핵심 카피 노출.
 *
 * 미들웨어가 미인증을 /login으로 끌어내리므로 `/dashboard` 검증은 실 로그인 필요.
 */

test("/login — 200 + 콘솔 에러 0 + 카피 렌더", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });

  const response = await page.goto("/login");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/운영부/);

  for (const phrase of ["로그인 — 운영부", "Microsoft SSO로 계속", "기록 · 응대 · 해결", "계정 생성 바로가기"]) {
    await expect(page.getByText(phrase, { exact: false }).first()).toBeVisible();
  }

  expect(errors, `console errors on /login: ${errors.join(" | ")}`).toEqual([]);
});

test("/dashboard — 인증 후 카피 렌더 + 콘솔 에러 0 (TEST_USER 미설정 시 skip)", async ({
  page,
}) => {
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    "TEST_USER_EMAIL/TEST_USER_PASSWORD 미설정"
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });

  await page.goto("/login");
  await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/dashboard$/);

  for (const phrase of ["결제 게이트웨이", "주요 서비스", "박현주", "Prometheus"]) {
    await expect(page.getByText(phrase, { exact: false }).first()).toBeVisible();
  }

  expect(errors, `console errors on /dashboard: ${errors.join(" | ")}`).toEqual([]);
});

test("/ 미인증 진입은 /login으로 리디렉트되고 콘솔 에러 0", async ({ page }) => {
  // 미들웨어가 클라이언트 쿠키 없는 요청을 /login으로 보냄.
  // 이 테스트는 로그인 안 한 깨끗한 컨텍스트라 /login에 떨어진다.
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });

  await page.goto("/");
  expect(page.url()).toMatch(/\/login$/);
  await expect(page.getByText("Microsoft SSO로 계속")).toBeVisible();
  expect(errors, `console errors on /: ${errors.join(" | ")}`).toEqual([]);
});
