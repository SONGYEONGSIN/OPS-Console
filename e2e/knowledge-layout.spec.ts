import { test, expect } from "@playwright/test";

/**
 * 지식망 문서 탭은 좌측 트리 + 우측 본문이다.
 *
 * 예전엔 두 칸에 스크롤이 없어 **트리가 길면 페이지가 통째로 밀렸다** — 문서를
 * 읽으려고 내리면 트리도 같이 올라가 버려 다음 문서를 고를 수 없었다.
 * 운영가이드처럼 메뉴를 제자리에 두고 각 칸이 자기 안에서 스크롤한다.
 */
test.describe("지식망 레이아웃 — 메뉴 고정, 칸별 스크롤", () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(isMobile, "모바일은 한 줄로 떨어져 높이를 걸지 않는다");
    test.skip(
      !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
      "TEST_USER 미설정 — 인증 필요",
    );
    await page.goto("/login");
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard$/);
    await page.goto("/dashboard/knowledge");
  });

  test("트리 칸과 본문 칸이 각자 스크롤한다", async ({ page }) => {
    const cols = page.locator("section.grid > div");
    await expect(cols).toHaveCount(2);
    for (const i of [0, 1]) {
      const overflowY = await cols
        .nth(i)
        .evaluate((el) => getComputedStyle(el).overflowY);
      expect(overflowY, `${i}번째 칸`).toBe("auto");
    }
  });

  /** 칸 높이가 화면을 넘으면 페이지가 밀려 트리가 따라 올라간다. */
  test("두 칸 모두 화면 높이를 넘지 않는다", async ({ page }) => {
    const vh = page.viewportSize()!.height;
    const cols = page.locator("section.grid > div");
    for (const i of [0, 1]) {
      const h = await cols.nth(i).evaluate((el) => el.getBoundingClientRect().height);
      expect(h, `${i}번째 칸 높이`).toBeLessThanOrEqual(vh);
    }
  });

  /**
   * 한 칸짜리 탭(초안·검토·빈틈)도 같은 높이 안에 들어왔다. 자기가 스크롤하지
   * 않으면 긴 본문이 잘려 아래가 아예 안 보인다.
   */
  test("한 칸짜리 탭도 자기 안에서 스크롤한다", async ({ page }) => {
    for (const tab of ["draft", "review", "gaps"]) {
      await page.goto(`/dashboard/knowledge?tab=${tab}`);
      const sec = page.getByTestId("knowledge-panel");
      const overflowY = await sec.evaluate(
        (el) => getComputedStyle(el).overflowY,
      );
      expect(overflowY, tab).toBe("auto");
      const h = await sec.evaluate((el) => el.getBoundingClientRect().height);
      expect(h, `${tab} 높이`).toBeLessThanOrEqual(page.viewportSize()!.height);
    }
  });
});
