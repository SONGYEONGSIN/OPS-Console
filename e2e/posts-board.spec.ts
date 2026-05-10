import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";

/**
 * /dashboard/feedback + /dashboard/notices — DB 연동 게시판 (post variant) UX 검증.
 *
 * 단일 TEST_USER + scripts/toggle-permission 토글:
 * - admin: feedback/notice 모두 작성·수정·삭제
 * - member: feedback 작성·본인글 수정 / notice 작성 hide (canCreate=false)
 *
 * afterEach: admin reset + '[E2E]' 접두사 테스트 글 cleanup.
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

function cleanupTestPosts() {
  execSync("node scripts/cleanup-test-posts.mjs", { stdio: "pipe" });
}

async function signInAndGoto(
  page: import("@playwright/test").Page,
  path: string,
) {
  await page.goto("/login");
  await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/dashboard$/);
  await page.goto(path);
}

test.describe("/dashboard/notices — admin 게시판 흐름", () => {
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    "TEST_USER 미설정",
  );
  test.skip(
    ({ viewport }) => !!viewport && viewport.width < 1024,
    "데스크탑 한정",
  );

  test.afterEach(async () => {
    togglePermission("admin");
    toggleMenus([]);
    cleanupTestPosts();
  });

  test("admin: 새 공지 작성 폼 + 저장 → optimistic 표시", async ({ page }) => {
    togglePermission("admin");
    await signInAndGoto(page, "/dashboard/notices");

    await expect(
      page.getByRole("button", { name: /\+ 새 공지/ }),
    ).toBeVisible();

    await page.getByRole("button", { name: /\+ 새 공지/ }).click();
    await page.getByLabel("제목").fill("[E2E] 테스트 공지");
    await page.getByLabel("내용").fill("e2e 작성 본문");
    await page.getByRole("button", { name: "저장" }).click();

    // optimistic UI — table에 즉시 반영
    await expect(page.getByText("[E2E] 테스트 공지")).toBeVisible();
    // DB persist + 새로고침 유지 검증은 dev manual / 후속 e2e 분리
  });

  test("member: notice 신규 버튼 hide + 시드 read 가능", async ({ page }) => {
    togglePermission("member");
    toggleMenus(["notices", "feedback"]);
    await signInAndGoto(page, "/dashboard/notices");

    // canCreate=false / readOnly=true
    await expect(
      page.getByRole("button", { name: /\+ 새 공지/ }),
    ).toHaveCount(0);

    // 시드 공지 read OK
    await expect(page.getByText("2026 Q3 운영 정책 변경")).toBeVisible();
  });
});

test.describe("/dashboard/feedback — 게시판 작성/수정 흐름", () => {
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    "TEST_USER 미설정",
  );
  test.skip(
    ({ viewport }) => !!viewport && viewport.width < 1024,
    "데스크탑 한정",
  );

  test.afterEach(async () => {
    togglePermission("admin");
    toggleMenus([]);
    cleanupTestPosts();
  });

  test("member: feedback 작성 버튼 노출 + 시드 read", async ({ page }) => {
    togglePermission("member");
    toggleMenus(["notices", "feedback"]);
    await signInAndGoto(page, "/dashboard/feedback");

    await expect(
      page.getByRole("button", { name: /\+ 새 개선 요청/ }),
    ).toBeVisible();

    // 시드 글 표시 확인 (DB 연동 회귀 방어)
    await expect(
      page.getByText("인스펙터 패널 width 320px이 좁음"),
    ).toBeVisible();
  });
});
