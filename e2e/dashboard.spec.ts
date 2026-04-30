import { test, expect } from "@playwright/test";

/**
 * /dashboard — 데스크탑 인터랙션 (≥1280, 데스크탑 풀 레이아웃)
 *
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

test.describe("/dashboard — 데스크탑", () => {
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

  test("타이틀바/메뉴바/사이드바/콘텐츠/인스펙터/스테이터스바 모두 렌더", async ({
    page,
  }) => {
    await expect(page.getByText("운영부 · 운영 상황실")).toBeVisible();
    await expect(page.getByRole("button", { name: /송영석/ })).toBeVisible();
    await expect(
      page.getByLabel("운영부 메뉴").getByText("서비스 그룹", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /실시간.*서비스 운영/ })
    ).toBeVisible();
    // 인스펙터 헤더 (결제 게이트웨이 — 인스펙터 영역에서만 h2)
    await expect(
      page.getByRole("heading", { name: "결제 게이트웨이", level: 2 })
    ).toBeVisible();
    await expect(page.getByText("연결됨")).toBeVisible();
  });

  test("초기 선택된 행: SVC-PAY-001(결제 게이트웨이)이 active", async ({ page }) => {
    // page.tsx의 selectedId 초기값 = "SVC-PAY-001"
    const rows = page.locator('button[aria-pressed]', { hasText: "결제 게이트웨이" });
    await expect(rows.first()).toHaveAttribute("aria-pressed", "true");
  });

  test("다른 서비스 행 클릭 시 선택 상태가 이동", async ({ page }) => {
    const initial = page.locator('button[aria-pressed]', { hasText: "결제 게이트웨이" });
    const target = page.locator('button[aria-pressed]', { hasText: "회원 서비스" });

    await expect(initial.first()).toHaveAttribute("aria-pressed", "true");
    await target.first().click();
    await expect(target.first()).toHaveAttribute("aria-pressed", "true");
    await expect(initial.first()).toHaveAttribute("aria-pressed", "false");
  });

  test("행 클릭 시 인스펙터 헤더(이름/ref)가 동적 교체된다", async ({ page }) => {
    const inspectorTitle = page.locator("#inspector-title");

    // 초기: 결제 게이트웨이
    await expect(inspectorTitle).toHaveText("결제 게이트웨이");
    await expect(page.locator("#inspector")).toContainText(
      "SVC-PAY-001 · v2.14.3 · PROD"
    );

    // Redis 캐시 클러스터 클릭
    await page
      .locator('button[aria-pressed]', { hasText: "Redis 캐시 클러스터" })
      .first()
      .click();
    await expect(inspectorTitle).toHaveText("Redis 캐시 클러스터");
    await expect(page.locator("#inspector")).toContainText("CACHE-RDS-001");

    // DB 마스터 클릭
    await page
      .locator('button[aria-pressed]', { hasText: "DB 마스터 (Postgres)" })
      .first()
      .click();
    await expect(inspectorTitle).toHaveText("DB 마스터 (Postgres)");
    await expect(page.locator("#inspector")).toContainText("DB-PRI-001");
  });

  test("결제 게이트웨이 외 서비스는 placeholder 인스펙터(Supabase 안내)를 표시", async ({
    page,
  }) => {
    await page
      .locator('button[aria-pressed]', { hasText: "회원 서비스" })
      .first()
      .click();
    await expect(page.locator("#inspector")).toContainText(
      "Supabase 연결 후 실시간 표시됩니다."
    );
    // 결제 게이트웨이 한정 데이터(런타임 Java 17)는 노출되지 않아야 함
    await expect(page.locator("#inspector")).not.toContainText("Spring Boot");
  });

  test("사용자 dropdown: 송영석 클릭으로 토글, 외부 클릭으로 닫힘", async ({
    page,
  }) => {
    const userBtn = page.getByRole("button", { name: /송영석/ });
    const logoutItem = page.getByRole("menuitem", { name: /로그아웃/ });

    // 1) 송영석 클릭 → dropdown 열림
    await userBtn.click();
    await expect(userBtn).toHaveAttribute("aria-expanded", "true");
    await expect(logoutItem).toBeVisible();

    // 2) 외부 클릭 → 닫힘
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await expect(userBtn).toHaveAttribute("aria-expanded", "false");
    await expect(logoutItem).not.toBeVisible();
  });

  test("사이드바 그룹 토글: '프로젝트' 닫힘 상태 → 클릭 → 열림", async ({ page }) => {
    const projectToggle = page.getByRole("button", { name: /프로젝트/, exact: false });
    await expect(projectToggle.first()).toHaveAttribute("aria-expanded", "false");

    await projectToggle.first().click();
    await expect(projectToggle.first()).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("link", { name: /PIMS/ })).toBeVisible();

    // 다시 클릭 → 닫힘
    await projectToggle.first().click();
    await expect(projectToggle.first()).toHaveAttribute("aria-expanded", "false");
  });

  test("필터 칩: '내 담당' 클릭하면 '전체'가 비활성", async ({ page }) => {
    const all = page.getByRole("button", { name: "전체", exact: true });
    const mine = page.getByRole("button", { name: "내 담당", exact: true });

    // 초기 active = 전체 (배경 ink + 글자 cream)
    await expect(all).toHaveClass(/bg-ink/);
    await expect(mine).not.toHaveClass(/bg-ink/);

    await mine.click();
    await expect(mine).toHaveClass(/bg-ink/);
    await expect(all).not.toHaveClass(/bg-ink/);
  });

  test("뷰스위치: '카드' 클릭 → 활성 전환", async ({ page }) => {
    const list = page.getByRole("button", { name: /목록/ });
    const card = page.getByRole("button", { name: /카드/ });

    await expect(list).toHaveClass(/bg-ink/);
    await card.click();
    await expect(card).toHaveClass(/bg-ink/);
    await expect(list).not.toHaveClass(/bg-ink/);
  });

  test("탭 전환: '배치 진행 #2471' 클릭 → 활성 전환", async ({ page }) => {
    const tab1 = page.getByRole("button", { name: /실시간 대시보드/ });
    const tab2 = page.getByRole("button", { name: /배치 진행 #2471/ });

    await expect(tab1).toHaveClass(/bg-cream/);
    await tab2.click();
    await expect(tab2).toHaveClass(/bg-cream/);
  });

  test("사용자 dropdown → 로그아웃 클릭 시 /login으로 리디렉트", async ({ page }) => {
    await page.getByRole("button", { name: /송영석/ }).click();
    const logoutItem = page.getByRole("menuitem", { name: /로그아웃/ });
    await expect(logoutItem).toBeVisible();
    await logoutItem.click();
    await page.waitForURL(/\/login$/, { timeout: 10000 });
    expect(page.url()).toMatch(/\/login$/);
  });

  test("키보드 a11y: Tab 순회로 메뉴/서비스 행 도달 가능", async ({ page }) => {
    // 첫 Tab → 1번 메뉴(파일) 또는 그 이전 인터랙티브 요소.
    // 30번 정도 Tab 누르면 doc-row까지 도달해야 한다.
    let foundDocRow = false;
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el ? `${el.tagName}:${el.getAttribute("aria-pressed") ?? ""}` : "";
      });
      if (focused.startsWith("BUTTON:false") || focused.startsWith("BUTTON:true")) {
        // doc-row 또는 사이드바 아이템 (둘 다 aria-pressed 있음)
        foundDocRow = true;
        break;
      }
    }
    expect(foundDocRow, "Tab 60회 내에 aria-pressed 있는 button에 도달해야 한다").toBe(true);
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

  test("앱바 햄버거: 사이드바 드로어 open ↔ scrim 클릭으로 close", async ({ page }) => {
    const hamburger = page.getByRole("button", { name: "메뉴 열기" });
    const sidebar = page.locator("#sidebar");

    // 초기: 사이드바는 화면 밖 (translate-x-[-100%])
    await expect(sidebar).not.toHaveAttribute("aria-modal", "true");

    // 햄버거 클릭 → 드로어 열림
    await hamburger.click();
    await expect(sidebar).toHaveAttribute("aria-modal", "true");

    // Scrim은 드로어 외 영역. body 좌상단 클릭 시 scrim에 도달.
    // hamburger 위치(좌상단)와 겹치지 않도록 화면 우측 좌표 클릭.
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

  test("행 클릭 시 인스펙터 드로어 자동 오픈 + ESC로 닫힘", async ({ page }) => {
    const inspector = page.locator("#inspector");
    const row = page.locator('button[aria-pressed]', { hasText: "회원 서비스" });

    // 초기 상태에서 인스펙터는 닫혀있어야 함 (모바일 기본 false)
    await expect(inspector).not.toHaveAttribute("aria-modal", "true");

    await row.first().click();
    await expect(inspector).toHaveAttribute("aria-modal", "true");

    await page.keyboard.press("Escape");
    await expect(inspector).not.toHaveAttribute("aria-modal", "true");
  });
});
