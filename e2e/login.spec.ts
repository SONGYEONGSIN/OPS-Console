import { test, expect } from "@playwright/test";

test.describe("/login", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("브랜드 + 인증 패널 + 상태바 모두 렌더", async ({ page, viewport }) => {
    // titlebar(검정 상단) — 브랜드 ('운영부 상황실 계정이 없으신가요?' footer와 구분 위해 exact)
    await expect(page.getByText("운영부 상황실", { exact: true })).toBeVisible();
    // 인증 패널
    await expect(
      page.getByRole("heading", { name: "계정 인증", level: 2 })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Microsoft SSO로 계속/ })
    ).toBeVisible();
    // statusbar(검정 하단) — 좌측 "연결됨" 항상 노출
    await expect(page.getByText("연결됨")).toBeVisible();

    // statusbar 중앙은 max-md:hidden — 데스크탑만 검증.
    // 보안 컨텍스트에 따라 "TLS · HSTS" / "HTTP" 둘 중 하나, 그리고 lang · UTF-8 노출.
    if (viewport && viewport.width >= 768) {
      await expect(page.getByText(/UTF-8/)).toBeVisible();
    }
  });

  test("비밀번호 표시/숨김 토글이 type 속성을 전환한다", async ({ page }) => {
    const pwInput = page.locator('input[name="password"]');
    const toggle = page.getByRole("button", { name: "비밀번호 표시/숨김" });

    // 초기: password
    await expect(pwInput).toHaveAttribute("type", "password");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(toggle).toHaveText(/표시/);

    // 클릭 → text
    await toggle.click();
    await expect(pwInput).toHaveAttribute("type", "text");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(toggle).toHaveText(/숨김/);

    // 다시 클릭 → password 복귀
    await toggle.click();
    await expect(pwInput).toHaveAttribute("type", "password");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  test('이메일/비밀번호 필드는 noValidate 폼이라 required/minLength가 없다', async ({
    page,
  }) => {
    // 코드 리뷰 I8 회귀 가드 — "noValidate + required" 모순 제거됐는지 확인.
    const email = page.locator('input[name="email"]');
    const password = page.locator('input[name="password"]');
    await expect(email).not.toHaveAttribute("required", /.*/);
    await expect(password).not.toHaveAttribute("required", /.*/);
    await expect(password).not.toHaveAttribute("minlength", /.*/);
  });

  test('"이 기기 기억" 체크박스 기본 체크', async ({ page }) => {
    const cb = page.locator('input[name="remember"]');
    await expect(cb).toBeChecked();
  });

  test("Microsoft SSO 버튼은 활성 — onClick으로 OAuth 시작", async ({ page }) => {
    const sso = page.getByRole("button", { name: /Microsoft SSO로 계속/ });
    await expect(sso).toBeEnabled();
  });

  test("비밀번호 찾기 → 클릭 시 /forgot-password로 이동", async ({ page }) => {
    await page.getByText("비밀번호 찾기 →").click();
    await expect(page).toHaveURL(/\/forgot-password$/);
  });

  test("이 기기 기억 체크박스는 controlled — 클릭 시 토글", async ({ page }) => {
    const checkbox = page.locator('input[name="remember"]');
    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  });

  // 주의: page.getByRole("alert")는 Next.js의 __next-route-announcer__와 우리 alert 둘 다 매칭됨.
  //       (strict mode violation). 따라서 텍스트로 직접 매칭하는 게 안전.
  test("빈 이메일로 제출하면 zod 에러 alert이 노출된다", async ({ page }) => {
    // noValidate라 브라우저 막지 않고 Server Action으로 가서 zod에서 거름.
    await page.fill('input[name="password"]', "anything");
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByText("이메일을 입력해주세요.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("이메일 형식 잘못되면 zod 에러 alert이 노출된다", async ({ page }) => {
    await page.fill('input[name="email"]', "not-an-email");
    await page.fill('input[name="password"]', "anything");
    await page.locator('form button[type="submit"]').click();
    await expect(
      page.getByText("이메일 형식이 올바르지 않습니다.")
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("빈 비밀번호로 제출하면 zod 에러 alert이 노출된다", async ({ page }) => {
    await page.fill('input[name="email"]', "test@example.com");
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByText("비밀번호를 입력해주세요.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("잘못된 비밀번호 제출 시 Supabase 에러 alert 노출 (TEST_USER 미설정 시 skip)", async ({
    page,
  }) => {
    test.skip(
      !process.env.TEST_USER_EMAIL,
      "TEST_USER_EMAIL 미설정 — 실제 Supabase 호출 필요"
    );
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
    await page.fill('input[name="password"]', "wrong-password-deliberately");
    await page.locator('form button[type="submit"]').click();
    // app의 translateAuthError가 "Invalid login credentials" → 한국어로 변환
    await expect(
      page.getByText("이메일 또는 비밀번호가 올바르지 않습니다.")
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("탭 전환: 로그인 → 계정 생성 클릭 시 비밀번호 확인 input 등장", async ({
    page,
  }) => {
    await expect(page.locator('input[name="passwordConfirm"]')).not.toBeVisible();
    await page.getByRole("button", { name: "계정 생성", exact: true }).click();
    await expect(page.locator('input[name="passwordConfirm"]')).toBeVisible();
  });

  test("비밀번호 강도 인디케이터: 4항목 실시간 ✓/✗", async ({ page }) => {
    await page.getByRole("button", { name: "계정 생성", exact: true }).click();
    const pw = page.locator('input[name="password"]');
    await pw.fill("Pa1!aaaa");
    // 각 항목은 <li>로, 충족 시 text-sage 클래스. li:has-text로 직접 매칭.
    await expect(page.locator("li", { hasText: "대문자" })).toHaveClass(/text-sage/);
    await expect(page.locator("li", { hasText: /^.\s*숫자$/ })).toHaveClass(/text-sage/);
    await expect(page.locator("li", { hasText: "특수문자" })).toHaveClass(/text-sage/);
    await expect(page.locator("li", { hasText: "8자+" })).toHaveClass(/text-sage/);
  });

  test("비밀번호 강도 인디케이터: 미충족 시 muted/✗", async ({ page }) => {
    await page.getByRole("button", { name: "계정 생성", exact: true }).click();
    await page.locator('input[name="password"]').fill("aa");
    await expect(page.locator("li", { hasText: "대문자" })).toHaveClass(/text-muted/);
    await expect(page.locator("li", { hasText: "8자+" })).toHaveClass(/text-muted/);
  });

  test("비밀번호 일치 인디케이터", async ({ page }) => {
    await page.getByRole("button", { name: "계정 생성", exact: true }).click();
    await page.locator('input[name="password"]').fill("Aa1!aaaa");
    await page.locator('input[name="passwordConfirm"]').fill("Aa1!aaaa");
    await expect(page.getByText("비밀번호와 일치")).toBeVisible();
    await page.locator('input[name="passwordConfirm"]').fill("Bb2@bbbb");
    await expect(page.getByText("비밀번호와 다름")).toBeVisible();
  });

  test("계정 생성 — 이미 가입된 TEST_USER 이메일 → 중복 에러 (TEST_USER 미설정 시 skip)", async ({
    page,
  }) => {
    test.skip(
      !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
      "TEST_USER 미설정 — 실제 Supabase 호출 필요"
    );
    await page.getByRole("button", { name: "계정 생성", exact: true }).click();
    // TEST_USER_EMAIL은 이미 가입돼 있음 — app은 Supabase identities 빈 응답을 감지하여 명시적 에러 반환.
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
    await page.fill('input[name="password"]', "Aa1!aaaa");
    await page.fill('input[name="passwordConfirm"]', "Aa1!aaaa");
    // 모바일 viewport에서 SignUpForm이 길어 제출 버튼이 StatusBar에 가려짐 → DOM 직접 submit.
    await page.locator("form").evaluate((f) => (f as HTMLFormElement).requestSubmit());
    await expect(
      page.getByText("이미 가입된 이메일입니다.")
    ).toBeVisible({ timeout: 10000 });
  });
});

test("실시간 시계: titlebar 분 표시가 placeholder 후 실 시간으로 채워짐", async ({
  page,
}) => {
  await page.goto("/login");
  // 클라이언트 hydration 대기 — placeholder가 잠깐 보이고 즉시 실 시간 채워짐
  // 실 시간 형식 (`YYYY.MM.DD · 토 · HH:MM KST` — date · weekday · time) 매칭
  const titlebarRight = page.locator("text=/\\d{4}\\.\\d{2}\\.\\d{2} · . · \\d{2}:\\d{2} KST/");
  await expect(titlebarRight).toBeVisible({ timeout: 5000 });
});
