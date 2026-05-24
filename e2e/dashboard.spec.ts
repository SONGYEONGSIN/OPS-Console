import { test, expect } from "@playwright/test";

/**
 * /dashboard (실시간 현황) — KPI 3 + 서비스 현황 그룹박스 + LiveTable + 콘솔
 *
 * LivePageHeader → KPI 3 카드(좌) + SystemHealthPanel(우) → 서비스 현황 그룹박스(5 서브카드)
 *   → FilterTabs + LiveTable(좌) + ConsoleStream(우).
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

test.describe("/dashboard — 데스크탑 (실시간 현황 레이아웃)", () => {
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

  test("LivePageHeader: '실시간 현황' h1 타이틀 노출", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: "실시간 현황" })).toBeVisible();
  });

  test("KPI 3 카드: 오픈 예정 서비스 / 내 미완 할 일 / 사고 누적 데이터", async ({
    page,
  }) => {
    await expect(page.getByText("오픈 예정 서비스", { exact: true })).toBeVisible();
    await expect(page.getByText("내 미완 할 일", { exact: true })).toBeVisible();
    await expect(page.getByText("사고 누적 데이터", { exact: true })).toBeVisible();
  });

  test("서비스 현황 그룹박스: 5 서브카드 라벨 노출", async ({ page }) => {
    // MetricGroupBox title + 5 MetricSubcard label.
    // 라벨 일부("인수인계")는 LiveTable 도메인 배지와 동명 — [data-subgrid] scope로 한정.
    await expect(page.getByText("서비스 현황", { exact: true })).toBeVisible();
    const subgrid = page.locator("[data-subgrid]");
    for (const label of ["계약체결", "미수채권", "백업내용", "인수인계", "대학연락처"]) {
      await expect(subgrid.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test("SystemHealthPanel: '시스템 게이트웨이 상태' 노출", async ({ page }) => {
    await expect(page.getByText("시스템 게이트웨이 상태", { exact: true })).toBeVisible();
  });

  test("FilterTabs: 6 탭 + LiveTable 노출", async ({ page }) => {
    // ORDER: 전체 / 서비스 / 내 할 일 / 사고 / 백업 / 인수인계
    // 각 탭 버튼의 accessible name은 `{label} {count}` — SegmentToggle '전체' 단독 버튼과 구분.
    for (const tab of ["전체", "서비스", "내 할 일", "사고", "백업", "인수인계"]) {
      await expect(
        page.getByRole("button", { name: new RegExp(`^${tab} \\d+$`) }),
      ).toBeVisible();
    }
    await expect(page.locator("table").first()).toBeVisible();
  });

  test("ConsoleStream: '실시간 백그라운드 로그' 우측 패널 노출", async ({ page }) => {
    await expect(page.getByText("실시간 백그라운드 로그", { exact: true })).toBeVisible();
  });

  test("AlertsBell dropdown: 클릭 시 열림 → 외부 클릭 시 닫힘", async ({ page }) => {
    const bell = page.getByRole("button", { name: /알림 \d+건/ });
    await expect(bell).toHaveAttribute("aria-expanded", "false");

    await bell.click();
    await expect(bell).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("menu")).toBeVisible();

    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await expect(bell).toHaveAttribute("aria-expanded", "false");
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

});
