import { test, expect, type Locator } from "@playwright/test";

/**
 * 여러 줄 입력창은 내용만큼 늘어나고, 비우면 rows 높이로 돌아온다.
 *
 * globals.css base 레이어의 전역 규칙(`field-sizing: content` + rows 기반 최소 높이)이
 * 빌드 산출물에 살아 있는지 실제 브라우저로 본다. 단위 테스트는 소스의 규칙만 읽으므로
 * Tailwind·lightningcss 가 `attr()` 를 떨어뜨려도 초록이다 — 그걸 여기서 잡는다.
 *
 * 대상: 사고 보고 신규 작성의 `사고경위`(rows 4).
 * **저장 버튼은 누르지 않는다** — 운영 DB 에 행이 생기고 실제 보고 메일이 나간다.
 * Chromium 만 본다(Firefox·Safari 는 `field-sizing` 미지원 — rows 고정 높이가 정상).
 */
test.skip(
  !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
  "TEST_USER 미설정 — 인증 필요",
);

async function heightOf(field: Locator): Promise<number> {
  const box = await field.boundingBox();
  if (!box) throw new Error("사고경위 칸이 화면에 없습니다");
  return box.height;
}

test.describe("textarea 자동 늘림", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "데스크톱 Chromium 만 본다",
    );
    // 새 브라우저는 첫 방문 튜토리얼(driver.js) 오버레이가 클릭을 가로챈다.
    await page.addInitScript(() => {
      localStorage.setItem("ops-console:tutorial-seen:v2", "1");
    });
    await page.goto("/login");
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/);
  });

  test("사고경위 — 10줄 입력 시 늘고, 비우면 rows 높이로 돌아온다", async ({
    page,
  }) => {
    await page.goto("/dashboard/incidents");
    await page.getByRole("button", { name: "+ 사고 보고" }).click();

    const field = page.getByRole("textbox", { name: "사고경위" });
    await expect(field).toBeVisible();

    // 규칙이 산출물에 남아 있으면 최소 높이가 px 값이다(없으면 auto/0px).
    const minHeight = await field.evaluate(
      (el) => getComputedStyle(el).minHeight,
    );
    expect(minHeight).toMatch(/px$/);
    expect(parseFloat(minHeight)).toBeGreaterThan(0);

    const empty = await heightOf(field);

    const tenLines = Array.from(
      { length: 10 },
      (_, i) => `${i + 1}번째 줄`,
    ).join("\n");
    await field.fill(tenLines);
    await expect.poll(() => heightOf(field)).toBeGreaterThan(empty);

    await field.fill("");
    await expect.poll(() => heightOf(field)).toBe(empty);
  });
});
