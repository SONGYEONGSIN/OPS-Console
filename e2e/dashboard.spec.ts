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
    // ProjectEntry는 라벨 + 슬러그 + 매니저/분기/카운트를 한 줄로 묶어 link 접근 이름이 길다.
    // /PIMS/ substring으로 매칭 (사이드바와 본문 양쪽 hit, .first()로 첫 노출 확인).
    await expect(page.getByRole("link", { name: /PIMS/ }).first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: /접수관리자/ }).first(),
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
    // '1차'/'2차'는 OnCallPanel 라벨(<p>1차</p>) 외에 다른 곳에도 substring 매칭되어 strict mode 충돌.
    // exact:true로 OnCall zone의 단독 라벨만 매칭.
    await expect(page.getByText("1차", { exact: true })).toBeVisible();
    await expect(page.getByText("2차", { exact: true })).toBeVisible();
    await expect(page.getByText(/송영신/).first()).toBeVisible();
    await expect(page.getByText(/한효진/).first()).toBeVisible();
  });

  test("ActivityColumn: 최근 운영 흐름 활동 항목 노출", async ({ page }) => {
    await expect(page.getByText(/최근 운영 흐름/)).toBeVisible();
    await expect(page.getByText(/박지연/).first()).toBeVisible();
  });

  test("desktop chrome — OPS Console brand + 검색 + 우측 zone", async ({ page }) => {
    // DOM 순서: AppBar(mobile) → Chrome(desktop) 양쪽 다 'OPS Console' 포함.
    // .first()는 hidden mobile AppBar를 picker하므로 .last()로 데스크탑 chrome 선택.
    await expect(page.getByText("OPS Console", { exact: true }).last()).toBeVisible();
    await expect(page.getByText(">_").first()).toBeVisible();
    await expect(page.locator('input[placeholder*="검색"]')).toBeVisible();
    // SessionTimer는 aria-label='세션 NN:NN 남음'으로 식별 (ShiftTimeline의 '15:00'과 strict mode 충돌 회피)
    await expect(page.getByLabel(/세션 \d{2}:\d{2} 남음/)).toBeVisible();
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
    // TEST_USER_EMAIL=ys1114@... → operators 시드의 송영신과 매칭 (test 92와 일치)
    await page.getByRole("button", { name: /송영신/ }).click();
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

/* ════════════════════════════════════════════════════════════
   /dashboard/[slug] — PageHeader (Epic 2)
   ════════════════════════════════════════════════════════════ */
test.describe("/dashboard/[slug] — PageHeader (Epic 2)", () => {
  test.skip(
    ({ viewport }) => !!viewport && viewport.width < 1024,
    "데스크탑 (≥1024) 한정"
  );
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    "TEST_USER_EMAIL/TEST_USER_PASSWORD 미설정"
  );

  test.beforeEach(async ({ page }) => {
    // 미들웨어가 미인증 사용자를 /login으로 보내므로 dashboard 진입 전 로그인 필요.
    await signInAndGotoDashboard(page);
  });

  test("services에서 headline 노출", async ({ page }) => {
    await page.goto("/dashboard/services");
    // headline accent + title (PAGE_META.services) — h1 헤드라인 내부 확인
    const headline = page.locator("h1");
    await expect(headline).toContainText("서비스사이클");
    await expect(headline).toContainText("서비스");
  });

  test("alerts에서 헤드라인 노출", async ({ page }) => {
    await page.goto("/dashboard/alerts");
    await expect(page.getByText("지금", { exact: true })).toBeVisible();
    await expect(page.getByText("주의해야 할 알림", { exact: true })).toBeVisible();
  });
});

/* ════════════════════════════════════════════════════════════
   /dashboard — Inspector 슬라이드인 (Epic 3)
   ════════════════════════════════════════════════════════════ */
test.describe("/dashboard — Inspector 슬라이드인 (Epic 3)", () => {
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    "TEST_USER_EMAIL/TEST_USER_PASSWORD 미설정",
  );

  test.beforeEach(async ({ page }) => {
    await signInAndGotoDashboard(page);
  });

  test("services 행 클릭 → 패널 열림 → ESC 닫힘", async ({ page }) => {
    await page.goto("/dashboard/services");
    const firstRow = page.locator("tbody tr").first();
    await firstRow.click();
    // getByRole('complementary')은 aria-hidden=true 요소를 자동 필터하므로
    // 닫힌 상태도 검증하려면 aside[role] 직접 셀렉터로 매칭.
    const panel = page.locator("aside[role='complementary']");
    await expect(panel).toHaveAttribute("aria-hidden", "false");
    await page.keyboard.press("Escape");
    await expect(panel).toHaveAttribute("aria-hidden", "true");
  });

  test("alerts 위젯 클릭 → 패널 열림 → 외부 클릭으로 닫힘", async ({ page }) => {
    await page.goto("/dashboard/alerts");
    const firstWidget = page.locator("button[aria-pressed]").first();
    await firstWidget.click();
    const panel = page.locator("aside[role='complementary']");
    await expect(panel).toHaveAttribute("aria-hidden", "false");
    // InspectorPanel은 의도적으로 내부 닫기 버튼 없음 — ESC 또는 외부 mousedown으로 닫힘.
    // 위젯 외부 영역을 mousedown하여 onClose 트리거.
    await page.locator("body").click({ position: { x: 10, y: 10 } });
    await expect(panel).toHaveAttribute("aria-hidden", "true");
  });
});
