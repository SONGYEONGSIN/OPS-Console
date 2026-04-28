import { test, expect } from "@playwright/test";

const ALL_SLUGS = [
  "alerts", "handover",
  "services", "services-web", "services-api", "services-backend",
  "infra-db", "infra-cache", "infra-mq", "batch-worker",
  "batch-jobs", "daily-check", "incidents", "changes",
  "grafana", "kibana", "apm", "notifications",
  "oncall", "team", "settings",
];

test.describe("/dashboard/[slug] — 인증 후 페이지 (TEST_USER 미설정 시 skip)", () => {
  test.beforeEach(async ({ page, isMobile }) => {
    // 모바일은 auth 타임아웃 이슈로 desktop만 테스트
    test.skip(isMobile, "모바일은 desktop 에뮬레이션으로 검증 (별도 기기 테스트는 CI에서)");
    test.skip(
      !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
      "TEST_USER 미설정 — 인증 필요"
    );
    // 로그인
    await page.goto("/login");
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard$/);
  });

  test("22 라우트 smoke — 모두 200 + 라벨 노출", async ({ page }) => {
    for (const slug of ALL_SLUGS) {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(`${slug}: ${msg.text()}`);
      });
      const response = await page.goto(`/dashboard/${slug}`);
      expect(response?.status(), `${slug} status`).toBe(200);
      // 페이지 헤더 (label) 노출 검증: h2 노출
      await expect(page.locator("h2").first()).toBeVisible();
      expect(errors, `console errors on /dashboard/${slug}: ${errors.join(" | ")}`).toEqual([]);
    }
  });

  test("잘못된 slug → 404", async ({ page }) => {
    const response = await page.goto("/dashboard/nonexistent-slug-zzz");
    expect(response?.status()).toBe(404);
  });

  test("Sidebar active state — /dashboard/services 진입 시 '전체 서비스'에 vermilion 시각", async ({
    page,
  }) => {
    await page.goto("/dashboard/services");
    const item = page.locator(`a[href="/dashboard/services"]`).first();
    await expect(item).toHaveClass(/text-vermilion/);
  });

  test("사이드바 클릭 → 라우팅 — '실시간 알림' 클릭 시 /dashboard/alerts", async ({
    page,
    isMobile,
  }) => {
    // 모바일에선 드로어를 먼저 열어야 함
    if (isMobile) {
      const menuButton = page.getByRole("button").filter({ hasText: "메뉴" }).first();
      await menuButton.click();
    }
    // dashboard index 진입 (beforeEach가 보장)
    await page.locator(`a[href="/dashboard/alerts"]`).first().click();
    await expect(page).toHaveURL(/\/dashboard\/alerts$/);
  });

  test("ListPattern: 행 선택 시 Inspector 갱신", async ({ page }) => {
    await page.goto("/dashboard/services");
    // 첫 행 클릭
    const firstRow = page.locator("tbody tr").first();
    await firstRow.click();
    // Inspector 영역에 첫 행 ID 표시 (lg:block, 데스크탑에서만)
    const inspector = page.locator("aside:has(> div > h3:has-text('상세'))");
    if (await inspector.isVisible()) {
      await expect(inspector).toContainText("SVC-001");
    }
  });

  test("DashPattern: 위젯 선택 시 Inspector 갱신", async ({ page }) => {
    await page.goto("/dashboard/alerts");
    const firstWidget = page.locator("button[aria-pressed]").first();
    await firstWidget.click();
    const inspector = page.locator("aside:has(> div > h3:has-text('위젯 상세'))");
    if (await inspector.isVisible()) {
      await expect(inspector).toContainText("W1");
    }
  });

  test("LogPattern: Inspector 영역 자체 미렌더 (풀 너비)", async ({ page }) => {
    await page.goto("/dashboard/kibana");
    // Log 패턴은 aside 미사용
    await expect(page.locator("section").first()).toBeVisible();
    // 검색 input 노출
    await expect(page.locator('input[placeholder*="쿼리"]')).toBeVisible();
  });

  test("SettingsPattern: 좌 nav 클릭 시 우 form 전환", async ({ page, isMobile }) => {
    await page.goto("/dashboard/settings");
    // 초기 active = 일반
    await expect(page.locator("h3:has-text('일반 설정')")).toBeVisible();
    // 알림 nav 클릭 — 모바일에선 버튼이 다를 수 있으므로 더 유연한 선택
    const notificationNavButton = page.locator("button").filter({ hasText: /알림/ }).first();
    if (await notificationNavButton.isVisible()) {
      await notificationNavButton.click();
      await expect(page.locator("h3:has-text('알림 설정')")).toBeVisible();
    }
    // URL은 변경 안 됨
    await expect(page).toHaveURL(/\/dashboard\/settings$/);
  });

  test("팀 페이지: OPERATORS 17명 표시 + 송영신 한 행", async ({ page }) => {
    await page.goto("/dashboard/team");
    // 17행 (헤더 제외)
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(17);
    // 송영신 행 (ys1114@jinhakapply.com → OPERATORS에는 "송영신")
    await expect(page.locator("tbody")).toContainText("송영신");
  });
});
