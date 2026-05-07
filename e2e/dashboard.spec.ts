import { test, expect } from "@playwright/test";

/**
 * /dashboard (실시간 현황) — OPSROOM 1면 (신문 메타포)
 *
 * Masthead → Lede → 좌(Triage / ProjectGrid / Activity) + 우 rail (Shift / OnCall).
 * 미들웨어가 미인증 사용자를 /login으로 보내므로 dashboard 시나리오는 실 로그인 필요.
 * `.env.local`의 `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` 채워두면 자동 검증, 없으면 전체 skip.
 */
async function signInAndGotoDashboard(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/dashboard$/);
}

test.describe("/dashboard — 데스크탑 (1면 신문 레이아웃)", () => {
  test.skip(
    ({ viewport }) => !!viewport && viewport.width < 1024,
    "데스크탑 (≥1024) 한정"
  );
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    "TEST_USER_EMAIL/TEST_USER_PASSWORD 미설정 — .env.local에 채워두면 dashboard 검증 활성화"
  );

  test.beforeEach(async ({ page }) => {
    await signInAndGotoDashboard(page);
  });

  test("Masthead: 'OPSROOM 일간' + vol 노출", async ({ page }) => {
    await expect(page.getByText("OPSROOM", { exact: false })).toBeVisible();
    await expect(page.getByText(/일간/).first()).toBeVisible();
    await expect(page.getByText(/vol\.\d{3}/)).toBeVisible();
  });

  test("Lede: '현재 긴급' kicker + 헤드라인 본문 노출", async ({ page }) => {
    await expect(page.getByText(/현재 긴급/).first()).toBeVisible();
  });

  test("ProjectGrid: 12개 도메인 링크가 /dashboard/<slug>로 이동", async ({
    page,
  }) => {
    const projectLinks = page.locator(
      'a[href^="/dashboard/"]:not([href="/dashboard/"]):not([href="/dashboard"])',
    );
    // 사이드바 항목과 본문 ProjectGrid 양쪽이 hit. 본문 한정 PIMS/접수관리자가 보이는지로 감지.
    await expect(page.getByRole("link", { name: /^PIMS$/ }).first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^접수관리자$/ }).first(),
    ).toBeVisible();
    expect(await projectLinks.count()).toBeGreaterThanOrEqual(12);
  });

  test("ShiftTimeline: 14:00–22:00 KST 범위 + 이벤트 라벨 노출", async ({
    page,
  }) => {
    await expect(page.getByText(/14:00 KST 개시/)).toBeVisible();
    await expect(page.getByText(/22:00 KST 마감/)).toBeVisible();
    await expect(page.getByText(/PIMS 점검 회의/).first()).toBeVisible();
  });

  test("OnCallPanel: 1차/2차 운영자 + 팀 메타 노출", async ({ page }) => {
    await expect(page.getByText("1차")).toBeVisible();
    await expect(page.getByText("2차")).toBeVisible();
    await expect(page.getByText(/송영신/).first()).toBeVisible();
    await expect(page.getByText(/한효진/).first()).toBeVisible();
  });

  test("ActivityColumn: 최근 운영 흐름 활동 항목 노출", async ({ page }) => {
    await expect(page.getByText(/최근 운영 흐름/)).toBeVisible();
    await expect(page.getByText(/박지연/).first()).toBeVisible();
  });

  test("desktop chrome — OPS Console brand + 검색 + 우측 zone", async ({ page }) => {
    await expect(page.getByText("OPS Console", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(">_").first()).toBeVisible();
    await expect(page.locator('input[placeholder*="검색"]')).toBeVisible();
    await expect(page.getByText("15:00")).toBeVisible();
    await expect(page.getByText("세션", { exact: true })).toBeVisible();
    await expect(
      page.getByLabel("운영부 메뉴").getByText("서비스 그룹", { exact: true })
    ).toBeVisible();
  });

  test("AlertsBell 클릭 시 /dashboard/alerts 이동", async ({ page }) => {
    await page.getByRole("button", { name: /알림/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/alerts$/);
  });

  test("사용자 dropdown: 풀네임 클릭으로 토글, 외부 클릭으로 닫힘", async ({
    page,
  }) => {
    const userBtn = page.getByRole("button", { name: /송영신/ });
    const logoutItem = page.getByRole("menuitem", { name: /로그아웃/ });

    await expect(userBtn).toBeVisible();
    await userBtn.click();
    await expect(userBtn).toHaveAttribute("aria-expanded", "true");
    await expect(logoutItem).toBeVisible();

    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await expect(userBtn).toHaveAttribute("aria-expanded", "false");
    await expect(logoutItem).not.toBeVisible();
  });

  test("사이드바 그룹 토글: '프로젝트' 닫힘 → 클릭 → 열림", async ({ page }) => {
    const projectToggle = page.getByRole("button", {
      name: /프로젝트/,
      exact: false,
    });
    await expect(projectToggle.first()).toHaveAttribute("aria-expanded", "false");

    await projectToggle.first().click();
    await expect(projectToggle.first()).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("link", { name: /PIMS/ }).first()).toBeVisible();

    await projectToggle.first().click();
    await expect(projectToggle.first()).toHaveAttribute("aria-expanded", "false");
  });

  test("사용자 dropdown → 로그아웃 클릭 시 /login으로 리디렉트", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /송영석/ }).click();
    const logoutItem = page.getByRole("menuitem", { name: /로그아웃/ });
    await expect(logoutItem).toBeVisible();
    await logoutItem.click();
    await page.waitForURL(/\/login$/, { timeout: 10000 });
    expect(page.url()).toMatch(/\/login$/);
  });
});

/* ════════════════════════════════════════════════════════════
   /dashboard — 모바일 (Pixel 5, 393×851) 한정
   ════════════════════════════════════════════════════════════ */
test.describe("/dashboard — 모바일 드로어", () => {
  test.skip(
    ({ viewport }) => !viewport || viewport.width >= 1024,
    "모바일 (≤1023) 한정"
  );
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    "TEST_USER_EMAIL/TEST_USER_PASSWORD 미설정"
  );

  test.beforeEach(async ({ page }) => {
    await signInAndGotoDashboard(page);
  });

  test("앱바 햄버거: 사이드바 드로어 open ↔ scrim 클릭으로 close", async ({
    page,
  }) => {
    const hamburger = page.getByRole("button", { name: "메뉴 열기" });
    const sidebar = page.locator("#sidebar");

    await expect(sidebar).not.toHaveAttribute("aria-modal", "true");

    await hamburger.click();
    await expect(sidebar).toHaveAttribute("aria-modal", "true");

    await page.mouse.click(380, 600);
    await expect(sidebar).not.toHaveAttribute("aria-modal", "true");
  });

  test("ESC 키로 사이드바 드로어 close", async ({ page }) => {
    const hamburger = page.getByRole("button", { name: "메뉴 열기" });
    const sidebar = page.locator("#sidebar");

    await hamburger.click();
    await expect(sidebar).toHaveAttribute("aria-modal", "true");

    await page.keyboard.press("Escape");
    await expect(sidebar).not.toHaveAttribute("aria-modal", "true");
  });
});
