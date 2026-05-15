import { test, expect } from "@playwright/test";

/**
 * /dashboard/services — URL 파라미터 기반 SSR 필터/검색/정렬/페이지네이션 회귀 검증.
 *
 * 지표: ScopeChips "전체 (N)" — N (서버 응답 total).
 * URL 파라미터에 따라 N이 변하는지로 SSR 필터 적용 여부 검증.
 */
test.skip(
  !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
  "TEST_USER 미설정 — 인증 필요",
);

test.describe("/dashboard/services — SSR 필터/검색/정렬", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/);
  });

  async function gotoServices(
    page: import("@playwright/test").Page,
    query = "",
  ) {
    await page.goto(`/dashboard/services${query}`);
    await page.waitForLoadState("networkidle");
  }

  async function readTotal(
    page: import("@playwright/test").Page,
  ): Promise<number> {
    const text = await page.getByRole("button", { name: "전체" }).innerText();
    const match = text.match(/\((\d+)\)/);
    if (!match) throw new Error(`전체 (N) 추출 실패: "${text}"`);
    return Number(match[1]);
  }

  test("baseline total > 0", async ({ page }) => {
    await gotoServices(page);
    expect(await readTotal(page)).toBeGreaterThan(0);
  });

  test("universityType=4년제 적용 시 total 감소", async ({ page }) => {
    await gotoServices(page);
    const base = await readTotal(page);
    await gotoServices(page, "?universityType=" + encodeURIComponent("4년제"));
    const filtered = await readTotal(page);
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(base);
  });

  test("category=정시 적용 시 total 감소", async ({ page }) => {
    await gotoServices(page);
    const base = await readTotal(page);
    await gotoServices(page, "?category=" + encodeURIComponent("정시"));
    const filtered = await readTotal(page);
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(base);
  });

  test("q=경찰 검색 시 total 감소 + 결과에 '경찰' 노출", async ({ page }) => {
    await gotoServices(page);
    const base = await readTotal(page);
    await gotoServices(page, "?q=경찰");
    const filtered = await readTotal(page);
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(base);
    await expect(page.getByText(/경찰/).first()).toBeVisible();
  });

  test("sort=service_id_asc + page=1 시 첫 row < 마지막 row", async ({
    page,
  }) => {
    await gotoServices(page, "?sort=service_id_asc&page=1");
    const idCells = page.locator("td.font-mono, [data-testid='service-id']");
    const count = await idCells.count();
    if (count >= 2) {
      const first = (await idCells.first().innerText()).trim();
      const last = (await idCells.last().innerText()).trim();
      expect(Number(first)).toBeLessThan(Number(last));
    }
  });

  test("page=2 시 첫 row content 변화", async ({ page }) => {
    await gotoServices(page, "?page=1");
    const p1FirstRow = await page.locator("tbody tr").first().innerText();
    await gotoServices(page, "?page=2");
    const p2FirstRow = await page.locator("tbody tr").first().innerText();
    expect(p2FirstRow).not.toBe(p1FirstRow);
  });
});
