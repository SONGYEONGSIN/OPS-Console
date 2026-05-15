import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";

/**
 * list 도메인 권한 기반 UI 가드 회귀 검증 (services 제외 — services-permission.spec.ts 참조).
 *
 * 서버 액션 isOperator() 는 admin/member만 허용.
 * page.tsx의 canCreate/readOnly도 동일 조건을 따라야 viewer 회귀 방지.
 */

const TEST_EMAIL = process.env.TEST_USER_EMAIL!;

function togglePermission(permission: "admin" | "member" | "viewer") {
  execSync(
    `TARGET_EMAIL='${TEST_EMAIL}' PERMISSION=${permission} node scripts/toggle-permission.mjs`,
    { stdio: "pipe" },
  );
}

function toggleMenus(menus: string[]) {
  execSync(
    `TARGET_EMAIL='${TEST_EMAIL}' MENUS='${menus.join(",")}' node scripts/toggle-allowed-menus.mjs`,
    { stdio: "pipe" },
  );
}

async function signInAndGoto(
  page: import("@playwright/test").Page,
  pagePath: string,
) {
  await page.goto("/login");
  await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/);
  await page.goto(pagePath);
  await page.waitForLoadState("networkidle");
}

const CASES: Array<{ slug: string; createLabel: RegExp }> = [
  { slug: "contacts", createLabel: /\+ 신규 연락처/ },
  { slug: "backup", createLabel: /\+ 백업 요청/ },
];

test.describe("list 도메인 — 권한 가드 회귀 (contacts / backup)", () => {
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    "TEST_USER 미설정",
  );

  test.afterEach(async () => {
    togglePermission("admin");
    toggleMenus([]);
  });

  for (const { slug, createLabel } of CASES) {
    test(`${slug} — admin: 신규 버튼 노출`, async ({ page }) => {
      togglePermission("admin");
      toggleMenus([]);
      await signInAndGoto(page, `/dashboard/${slug}`);
      await expect(
        page.getByRole("button", { name: createLabel }),
      ).toBeVisible();
    });

    test(`${slug} — viewer: 진입 가능하나 신규 버튼 미노출`, async ({
      page,
    }) => {
      togglePermission("viewer");
      toggleMenus([slug]);
      await signInAndGoto(page, `/dashboard/${slug}`);
      await expect(
        page.getByRole("button", { name: createLabel }),
      ).toHaveCount(0);
    });
  }
});
