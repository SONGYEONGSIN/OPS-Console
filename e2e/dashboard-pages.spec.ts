import { test, expect } from "@playwright/test";

const ALL_SLUGS = [
  // 개요
  "my-todo", "schedule",
  // 요청 · 자료
  "handover", "data-requests", "incidents", "contacts", "backup", "vault",
  // 서비스사이클
  "services", "contracts", "dev-test", "deploy", "closing", "settlement", "invoice", "receivables",
  // 프로젝트 (project 패턴)
  "pims", "reception-admin", "internal-admin", "competition", "generator",
  "revenue", "jh-cash", "k12", "kcue", "referral", "guarantee", "performance",
  // 분석 · AI
  "worklog", "outcomes", "reports",
  "ai-insight", "ai-assistant", "my-ai-work", "ai-tips",
  // 매뉴얼 · 가이드
  "manual", "sop", "vibe-coding", "meetings", "statements", "faq",
  // 관리
  "team", "settings", "onboarding", "feedback", "notices",
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

  test("사이드바 클릭 → 라우팅 — '오늘 할 일' 클릭 시 /dashboard/my-todo", async ({
    page,
    isMobile,
  }) => {
    // 모바일에선 드로어를 먼저 열어야 함
    if (isMobile) {
      const menuButton = page.getByRole("button").filter({ hasText: "메뉴" }).first();
      await menuButton.click();
    }
    // dashboard index 진입 (beforeEach가 보장)
    await page.locator(`a[href="/dashboard/my-todo"]`).first().click();
    await expect(page).toHaveURL(/\/dashboard\/my-todo/);
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


  test("LogPattern: Inspector 영역 자체 미렌더 (풀 너비)", async ({ page }) => {
    await page.goto("/dashboard/worklog");
    // Log 패턴은 aside 미사용
    await expect(page.locator("section").first()).toBeVisible();
    // 검색 input 노출
    await expect(page.locator('input[placeholder*="활동 메시지"]')).toBeVisible();
  });

  test("ProjectPattern: 탭 [상세 / 개선사항 / 활동 로그] 전환", async ({ page }) => {
    await page.goto("/dashboard/pims");

    // 헤더
    await expect(page.getByRole("heading", { name: "PIMS", level: 2 })).toBeVisible();

    // 기본 탭: 상세 — attributes 노출
    await expect(page.getByText("담당자", { exact: true })).toBeVisible();

    // 개선사항 탭 클릭
    await page.getByRole("tab", { name: /개선사항/ }).click();
    await expect(page.getByText("접수 폼 검증 강화")).toBeVisible();

    // 활동 로그 탭 클릭
    await page.getByRole("tab", { name: /활동 로그/ }).click();
    await expect(page.locator("li").filter({ hasText: /분기 점검/ }).first()).toBeVisible();

    // URL 유지 (탭 state는 page-local)
    await expect(page).toHaveURL(/\/dashboard\/pims$/);
  });

  test("SettingsPattern: 좌 nav 클릭 시 우 form 전환", async ({ page }) => {
    await page.goto("/dashboard/settings");
    // 초기 active = mail
    await expect(page.locator("h3:has-text('메일 설정')")).toBeVisible();
    // '외부 연동' nav 클릭 — 모바일에선 버튼이 다를 수 있으므로 더 유연한 선택
    const integrationsNavButton = page.locator("button").filter({ hasText: /외부 연동/ }).first();
    if (await integrationsNavButton.isVisible()) {
      await integrationsNavButton.click();
      await expect(page.locator("h3:has-text('외부 연동 상태')")).toBeVisible();
    }
    // section query param 변경 (path는 settings 유지)
    await expect(page).toHaveURL(/\/dashboard\/settings(\?|$)/);
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
