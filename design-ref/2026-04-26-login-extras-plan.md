# Login Extras Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Folio /login에 (1) Microsoft SSO 활성화, (2) "이 기기 기억 14일" 체크박스 동작, (3) 비밀번호 찾기 흐름(/forgot-password + /reset-password) 추가.

**Architecture:** server.ts 인프라(rememberMe 옵션) → schemas 확장 → Server Actions TDD(remember 통합 + forgotPassword + resetPassword) → middleware PUBLIC_PATHS 확장 → /auth/callback route handler → AuthShell 공통 셸 → 신규 페이지 2개 → /login 갱신(SSO 활성, 링크, remember controlled, error 파라미터) → mockup 동기화 → e2e 3 spec → 종합 검증.

**Tech Stack:** Next.js 16 (App Router) + React 19 + Tailwind v4 + zod + Supabase auth (`signInWithOAuth`, `resetPasswordForEmail`, `updateUser`, `exchangeCodeForSession`) + Vitest + Playwright.

**Repository note:** Folio는 git 저장소 아님. plan의 "commit" 단계는 *"검증 통과 보고"* 로 대체.

**Spec 참조:** `design-ref/2026-04-26-login-extras-design.md`

---

## File Structure

이 plan에서 생성/수정/참조되는 파일.

- **Create**: `src/app/auth/callback/route.ts` — OAuth code 교환 + next 파라미터 분기
- **Create**: `src/components/auth/AuthShell.tsx` — TitleBar + 중앙 폼 + StatusBar 공통 셸 (forgot/reset 공유)
- **Create**: `src/app/forgot-password/page.tsx` — 이메일 입력 폼
- **Create**: `src/app/reset-password/page.tsx` — 새 비밀번호 입력 폼
- **Create**: `e2e/forgot-password.spec.ts` — 신규 시나리오
- **Create**: `e2e/reset-password.spec.ts` — 신규 시나리오
- **Modify**: `src/lib/supabase/server.ts` — `createClient` 옵션 `rememberMe?: boolean` 추가, cookies setAll에서 maxAge override
- **Modify**: `src/features/auth/schemas.ts` — `forgotPasswordSchema`, `resetPasswordSchema` 추가
- **Modify**: `src/features/auth/actions.ts` — `forgotPassword`, `resetPassword` Server Actions 추가, `signIn`에 remember 처리
- **Modify**: `src/features/auth/actions.test.ts` — 10 신규 케이스 (signIn remember 2 + forgotPassword 3 + resetPassword 5)
- **Modify**: `src/middleware.ts` — PUBLIC_PATHS 확장
- **Modify**: `src/app/login/page.tsx` — SSOButton 활성화 + onClick handler, "비밀번호 찾기 →" href, remember controlled, error 파라미터 처리
- **Verify only**: `design-ref/folio-login.html` — mockup의 SSO 버튼은 이미 enabled 상태이므로 변경 없음. design-sync 측정으로 React 변경이 align 되는지 검증만
- **Modify**: `e2e/login.spec.ts` — 신규 시나리오 (SSO enabled, 비밀번호 찾기 라우팅, remember controlled)
- **Reference (no edit)**: `lib/supabase/{client,middleware}.ts`, `design-tokens.ts`, `globals.css`, `dashboard/*`

---

## Task 1: server.ts에 `rememberMe` 옵션 추가

`createClient`에 `rememberMe?: boolean` 옵션을 받아 cookie maxAge를 override한다. 미지정 시 Supabase 기본 동작 보존(호환성).

**Files:**
- Modify: `src/lib/supabase/server.ts`

- [ ] **Step 1: 현재 server.ts 읽기**

Run: `cat src/lib/supabase/server.ts`
Expected: createServerClient 호출 + cookies getAll/setAll 패턴이 보임.

- [ ] **Step 2: createClient 시그니처 변경**

`src/lib/supabase/server.ts` 전체를 다음으로 교체:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase server client.
 *
 * @param options.rememberMe — login 시 cookie 정책:
 *   - `true`: maxAge 14일 (이 기기 기억 체크 시)
 *   - `false`: maxAge undefined → session cookie (체크 미체크 시)
 *   - 미지정 (default): Supabase 기본 동작 (middleware/dashboard 등 일반 호출자)
 */
export async function createClient(options?: { rememberMe?: boolean }) {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options: cookieOptions }) => {
              const finalOptions =
                options?.rememberMe === true
                  ? { ...cookieOptions, maxAge: 14 * 24 * 3600 }
                  : options?.rememberMe === false
                    ? { ...cookieOptions, maxAge: undefined }
                    : cookieOptions;
              cookieStore.set(name, value, finalOptions);
            });
          } catch {
            // Server Component에서 cookie set 호출 시 에러 — middleware로 처리되므로 무시
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: tsc 회귀**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 4: 기존 호출자 회귀 확인 (lint + Vitest)**

Run: `npm run lint 2>&1 | tail -5 && npm test 2>&1 | tail -5`
Expected: lint 0 errors, Vitest 12/12 pass (rememberMe 미지정 호출자가 영향 없음)

- [ ] **Step 5: 체크포인트**

```
Task 1 완료 — server.ts createClient에 rememberMe 옵션 추가
- 미지정 시 Supabase 기본 동작 보존 ✓
- tsc 0, lint 0 errors, Vitest 12/12 pass
```

---

## Task 2: signIn에 remember 통합 (TDD)

`signIn` Server Action이 formData에서 remember 추출 후 `createClient({ rememberMe })`로 전달. RED-GREEN으로 2 케이스 추가.

**Files:**
- Modify: `src/features/auth/actions.ts`
- Modify: `src/features/auth/actions.test.ts`

- [ ] **Step 1: RED — actions.test.ts에 2 신규 케이스 추가**

기존 `describe("signIn", ...)` 블록 안의 마지막 it 다음에 추가:

```ts
  it("remember=on이면 createClient에 {rememberMe: true} 전달", async () => {
    mockCreate.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      },
    });
    const fd = new FormData();
    fd.set("email", "a@b.com");
    fd.set("password", "right");
    fd.set("remember", "on");
    await expect(signIn(undefined, fd)).rejects.toThrow("REDIRECT:/dashboard");
    expect(mockCreate).toHaveBeenCalledWith({ rememberMe: true });
  });

  it("remember 없으면 createClient에 {rememberMe: false} 전달", async () => {
    mockCreate.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      },
    });
    const fd = new FormData();
    fd.set("email", "a@b.com");
    fd.set("password", "right");
    // remember 미설정
    await expect(signIn(undefined, fd)).rejects.toThrow("REDIRECT:/dashboard");
    expect(mockCreate).toHaveBeenCalledWith({ rememberMe: false });
  });
```

- [ ] **Step 2: 테스트 실행 → RED 확인**

Run: `npm test 2>&1 | tail -20`
Expected: 2 신규 테스트 fail. 기존 signIn은 `createClient()`(인자 없음) 호출하므로 `toHaveBeenCalledWith({rememberMe: ...})` 검증 실패.

- [ ] **Step 3: GREEN — actions.ts의 signIn 갱신**

`src/features/auth/actions.ts`의 signIn 함수 내 `createClient()` 호출을 다음으로 교체:

```ts
  const remember = formData.get("remember") === "on";
  const supabase = await createClient({ rememberMe: remember });
```

(기존 `const supabase = await createClient();` 라인을 위 두 줄로 교체)

- [ ] **Step 4: 테스트 재실행 → GREEN 확인**

Run: `npm test 2>&1 | tail -20`
Expected: 14 passed (12 기존 + 2 신규).

- [ ] **Step 5: tsc 회귀**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 6: 체크포인트**

```
Task 2 완료 — signIn에 remember 통합 (TDD)
- RED 2 fail → GREEN 14/14 pass
- formData.get("remember") === "on" → createClient({rememberMe})
```

---

## Task 3: schemas — forgotPasswordSchema + resetPasswordSchema 추가

zod 스키마 두 개 추가. resetPasswordSchema는 signUpSchema에서 email을 제외한 형태(password + passwordConfirm + 강도 4 정규식 + refine).

**Files:**
- Modify: `src/features/auth/schemas.ts`

- [ ] **Step 1: schemas.ts 끝에 두 스키마 추가**

`src/features/auth/schemas.ts`의 마지막 `export type SignUpInput = ...` 다음에 추가:

```ts
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "이메일을 입력해주세요.")
    .email("이메일 형식이 올바르지 않습니다."),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "비밀번호는 8자 이상이어야 합니다.")
      .regex(/[A-Z]/, "영문 대문자를 포함해야 합니다.")
      .regex(/[0-9]/, "숫자를 포함해야 합니다.")
      .regex(
        /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/,
        "특수문자를 포함해야 합니다."
      ),
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "비밀번호 확인이 일치하지 않습니다.",
    path: ["passwordConfirm"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
```

- [ ] **Step 2: tsc 회귀**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: 체크포인트**

```
Task 3 완료 — schemas 추가
- forgotPasswordSchema, resetPasswordSchema export
- tsc 0
```

---

## Task 4: forgotPassword Server Action (TDD)

3 RED 테스트 → fail 확인 → 구현 → pass 확인.

**Files:**
- Modify: `src/features/auth/actions.test.ts`
- Modify: `src/features/auth/actions.ts`

- [ ] **Step 1: RED — actions.test.ts 끝에 forgotPassword 케이스 추가**

기존 `describe("signUp", ...)` 블록 다음(파일 끝)에 추가. 먼저 import 갱신: `import { signIn, signOut, signUp, forgotPassword } from "./actions";`

```ts
// vi.mock("next/headers", ...) 가 파일 상단에 없으면 추가:
// (기존 vi.mock 선언부와 같은 위치 — file top imports 직후)

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (name: string) => {
      if (name === "host") return "localhost:3001";
      if (name === "x-forwarded-proto") return "http";
      return null;
    },
  })),
  cookies: vi.fn(),
}));

describe("forgotPassword", () => {
  beforeEach(() => vi.clearAllMocks());

  it("빈 이메일이면 zod 에러 반환", async () => {
    const fd = new FormData();
    fd.set("email", "");
    const result = await forgotPassword(undefined, fd);
    expect(result).toEqual({ error: "이메일을 입력해주세요." });
  });

  it("이메일 형식 잘못되면 zod 에러", async () => {
    const fd = new FormData();
    fd.set("email", "not-an-email");
    const result = await forgotPassword(undefined, fd);
    expect(result).toEqual({ error: "이메일 형식이 올바르지 않습니다." });
  });

  it("정상 이메일 시 resetPasswordForEmail 호출 + info 반환 (enumeration 방지)", async () => {
    const resetSpy = vi.fn().mockResolvedValue({ error: null });
    mockCreate.mockResolvedValue({ auth: { resetPasswordForEmail: resetSpy } });
    const fd = new FormData();
    fd.set("email", "user@example.com");
    const result = await forgotPassword(undefined, fd);
    expect(resetSpy).toHaveBeenCalledWith("user@example.com", {
      redirectTo: "http://localhost:3001/auth/callback?next=/reset-password",
    });
    expect(result).toEqual({
      info: "재설정 링크를 발송했습니다. 메일함을 확인해주세요.",
    });
  });
});
```

- [ ] **Step 2: 테스트 실행 → RED 확인**

Run: `npm test 2>&1 | tail -25`
Expected: 3 신규 fail (`forgotPassword` import 실패 또는 정의 없음).

- [ ] **Step 3: GREEN — actions.ts에 forgotPassword 구현**

`src/features/auth/actions.ts` 상단 import 갱신:
```ts
import { headers } from "next/headers";
import { signInSchema, signUpSchema, forgotPasswordSchema } from "./schemas";
```

`signOut` 함수 위(또는 signUp 다음)에 추가:

```ts
export async function forgotPassword(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "";
  const origin = `${proto}://${host}`;

  const supabase = await createClient();
  // 보안: 가입 여부 enumeration 방지 — 에러 결과와 무관하게 동일 info 반환.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  return { info: "재설정 링크를 발송했습니다. 메일함을 확인해주세요." };
}
```

- [ ] **Step 4: 테스트 재실행 → GREEN 확인**

Run: `npm test 2>&1 | tail -10`
Expected: 17 passed (14 + 3 신규).

- [ ] **Step 5: tsc 회귀**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 6: 체크포인트**

```
Task 4 완료 — forgotPassword Server Action (TDD)
- RED 3 fail → GREEN 17/17 pass
- enumeration 방지: 에러와 무관하게 동일 info
```

---

## Task 5: resetPassword Server Action (TDD)

5 RED 테스트 → fail → 구현 → pass.

**Files:**
- Modify: `src/features/auth/actions.test.ts`
- Modify: `src/features/auth/actions.ts`

- [ ] **Step 1: RED — actions.test.ts 끝에 resetPassword 케이스 추가**

import 갱신: `import { signIn, signOut, signUp, forgotPassword, resetPassword } from "./actions";`

기존 `describe("forgotPassword", ...)` 다음에 추가:

```ts
describe("resetPassword", () => {
  beforeEach(() => vi.clearAllMocks());

  it("빈 비밀번호면 zod 에러 반환", async () => {
    const fd = new FormData();
    fd.set("password", "");
    fd.set("passwordConfirm", "");
    const result = await resetPassword(undefined, fd);
    expect(result).toEqual({ error: "비밀번호는 8자 이상이어야 합니다." });
  });

  it("비밀번호 8자 미만이면 zod 에러", async () => {
    const fd = new FormData();
    fd.set("password", "Aa1!aa");
    fd.set("passwordConfirm", "Aa1!aa");
    const result = await resetPassword(undefined, fd);
    expect(result).toEqual({ error: "비밀번호는 8자 이상이어야 합니다." });
  });

  it("비밀번호 대문자 누락이면 zod 에러", async () => {
    const fd = new FormData();
    fd.set("password", "aa1!aaaa");
    fd.set("passwordConfirm", "aa1!aaaa");
    const result = await resetPassword(undefined, fd);
    expect(result).toEqual({ error: "영문 대문자를 포함해야 합니다." });
  });

  it("비밀번호 확인 불일치면 refine 에러", async () => {
    const fd = new FormData();
    fd.set("password", "Aa1!aaaa");
    fd.set("passwordConfirm", "Bb2@bbbb");
    const result = await resetPassword(undefined, fd);
    expect(result).toEqual({ error: "비밀번호 확인이 일치하지 않습니다." });
  });

  it("성공 시 updateUser 호출 + /dashboard로 redirect", async () => {
    const updateSpy = vi.fn().mockResolvedValue({ error: null });
    mockCreate.mockResolvedValue({ auth: { updateUser: updateSpy } });
    const fd = new FormData();
    fd.set("password", "Aa1!aaaa");
    fd.set("passwordConfirm", "Aa1!aaaa");
    await expect(resetPassword(undefined, fd)).rejects.toThrow(
      "REDIRECT:/dashboard"
    );
    expect(updateSpy).toHaveBeenCalledWith({ password: "Aa1!aaaa" });
  });
});
```

- [ ] **Step 2: 테스트 실행 → RED 확인**

Run: `npm test 2>&1 | tail -20`
Expected: 5 신규 fail (`resetPassword` 정의 없음).

- [ ] **Step 3: GREEN — actions.ts에 resetPassword 구현**

`src/features/auth/actions.ts` 상단 import 갱신 (forgotPasswordSchema 옆에 resetPasswordSchema 추가):
```ts
import { signInSchema, signUpSchema, forgotPasswordSchema, resetPasswordSchema } from "./schemas";
```

`forgotPassword` 다음에 추가:

```ts
export async function resetPassword(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
```

- [ ] **Step 4: 테스트 재실행 → GREEN 확인**

Run: `npm test 2>&1 | tail -10`
Expected: 22 passed (17 + 5 신규).

- [ ] **Step 5: tsc 회귀**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 6: 체크포인트**

```
Task 5 완료 — resetPassword Server Action (TDD)
- RED 5 fail → GREEN 22/22 pass
- 성공 시 updateUser + /dashboard redirect
```

---

## Task 6: middleware.ts PUBLIC_PATHS 확장

`/forgot-password`, `/reset-password`, `/auth/callback`을 인증 없이 접근 가능하게.

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: PUBLIC_PATHS 라인 변경**

`src/middleware.ts`의 다음 라인 변경:

```ts
// before
const PUBLIC_PATHS = ["/login"];

// after
const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/auth/callback"];
```

- [ ] **Step 2: tsc 회귀**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: 회귀 e2e (기존 시나리오 0 failed)**

dev server 죽이고 e2e 돌리고 다시 살린다:

```bash
PID=$(cat /tmp/folio-dev-3001.pid 2>/dev/null); kill "$PID" 2>/dev/null; sleep 2
npm run test:e2e 2>&1 | tail -10
PATH=/usr/local/bin:/usr/bin:/bin:$PATH npx next dev -p 3001 > /tmp/folio-dev-3001.log 2>&1 &
echo $! > /tmp/folio-dev-3001.pid
sleep 4
```

Expected: 52 passed / 16 skipped / 0 failed (변동 없음 — 신규 PUBLIC_PATHS는 아직 라우트 없음).

- [ ] **Step 4: 체크포인트**

```
Task 6 완료 — middleware PUBLIC_PATHS 확장
- /forgot-password, /reset-password, /auth/callback 추가
- e2e 회귀 0 failed
```

---

## Task 7: /auth/callback Route Handler

OAuth code 교환 + `next` 파라미터로 redirect 분기.

**Files:**
- Create: `src/app/auth/callback/route.ts`

- [ ] **Step 1: route.ts 생성**

```bash
mkdir -p src/app/auth/callback
```

- [ ] **Step 2: route.ts 작성**

`src/app/auth/callback/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth callback (SSO) + 비밀번호 reset 메일 링크의 진입점.
 * `next` 파라미터로 redirect 분기 — 미지정 시 /dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
```

- [ ] **Step 3: tsc 회귀**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 4: 수동 동작 확인 (dev)**

dev server에서 `http://localhost:3001/auth/callback` 직접 진입:
Expected: `/login?error=missing_code`로 redirect.

- [ ] **Step 5: 체크포인트**

```
Task 7 완료 — /auth/callback route handler
- oauth_failed / missing_code / exchange_failed 분기 ✓
- next 파라미터로 redirect 분기 ✓
- tsc 0
```

---

## Task 8: AuthShell 공통 컴포넌트

forgot/reset 두 페이지가 공유하는 셸 — TitleBar + 중앙 폼 + StatusBar.

**Files:**
- Create: `src/components/auth/AuthShell.tsx`

- [ ] **Step 1: 디렉터리 + 파일 생성 + 코드 작성**

```bash
mkdir -p src/components/auth
```

`src/components/auth/AuthShell.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

/**
 * forgot-password / reset-password 페이지의 공통 셸.
 *
 * Layout: TitleBar (시계 포함) + 중앙 정렬 폼 영역 + StatusBar.
 * BrandPanel은 의도적으로 제외 — 짧은 transactional 흐름이라 BrandPanel 비례 부담스러움.
 *
 * children에 폼 본문 (max-w-[420px] 셸 안에서).
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const updateNow = () => setNow(new Date());
    updateNow();
    const id = setInterval(updateNow, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative z-10 grid h-screen grid-rows-[34px_1fr_26px]">
      <TitleBar now={now} />
      <main className="flex items-center justify-center px-4 py-5 md:px-5 md:py-6 lg:px-7 lg:py-8">
        <div className="w-full max-w-[420px]">{children}</div>
      </main>
      <StatusBar />
    </div>
  );
}

function TitleBar({ now }: { now: Date | null }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center border-b border-line bg-ink px-3.5 text-cream">
      <div className="mr-[18px] flex gap-[7px] max-[479px]:hidden">
        <span className="h-3 w-3 rounded-full border border-cream/20 bg-vermilion" />
        <span className="h-3 w-3 rounded-full border border-cream/20 bg-gold" />
        <span className="h-3 w-3 rounded-full border border-cream/20 bg-sage" />
      </div>
      <div className="text-center text-md font-medium tracking-[0.02em]">
        운영부 <em className="not-italic text-vermilion mx-[3px]">·</em> 로그인
        <span className="ml-1.5 text-sm text-faint max-md:hidden">OPSROOM</span>
      </div>
      <div className="ref text-xs text-faint tracking-[0.04em] max-[479px]:text-[10px]">
        <Clock now={now} />
      </div>
    </div>
  );
}

function Clock({ now }: { now: Date | null }) {
  if (!now) return <>------ · --:-- KST</>;
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("ko-KR", { ...opts, timeZone: "Asia/Seoul" }).format(
      now
    );
  const date = fmt({
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .replace(/\. /g, ".")
    .replace(/\.$/, "");
  const time = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });
  return <>{`${date} · ${time} KST`}</>;
}

function StatusBar() {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-5 border-t border-line bg-washi-raised px-4 text-xs tracking-[0.02em] text-muted max-md:gap-3 max-md:px-3">
      <div className="flex items-center gap-5">
        <span className="flex items-center">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-sage [box-shadow:var(--shadow-led-sage)]" />
          <span>연결됨</span>
        </span>
        <span>
          <strong className="mr-1 font-medium text-ink-soft">서버</strong>
          auth.opsroom.local
        </span>
      </div>
      <div className="flex items-center justify-center gap-5 max-md:hidden">
        <span>TLS 1.3 · HSTS</span>
        <span>KR / EN · UTF-8</span>
      </div>
      <div className="flex items-center justify-end gap-5">
        <span className="max-[479px]:hidden">
          <strong className="mr-1 font-medium text-ink-soft">빌드</strong>v 4.2.1
        </span>
        <span className="code">sha 8c3f2a1</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: tsc + lint 회귀**

Run: `npx tsc --noEmit && npm run lint 2>&1 | tail -5`
Expected: tsc 0, lint 0 errors

- [ ] **Step 3: 체크포인트**

```
Task 8 완료 — AuthShell 공통 컴포넌트
- TitleBar(시계 포함) + 중앙 폼 + StatusBar
- BrandPanel 의도적 제외
- tsc 0, lint 0
```

---

## Task 9: /forgot-password 페이지

이메일 입력 폼 + forgotPassword Server Action 연결.

**Files:**
- Create: `src/app/forgot-password/page.tsx`

- [ ] **Step 1: 디렉터리 + 파일 생성**

```bash
mkdir -p src/app/forgot-password
```

`src/app/forgot-password/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { forgotPassword, type AuthState } from "@/features/auth/actions";
import { AuthShell } from "@/components/auth/AuthShell";

export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState<AuthState, FormData>(
    forgotPassword,
    undefined
  );

  return (
    <AuthShell>
      <nav className="mb-5 flex items-center gap-2 text-xs tracking-[0.04em] text-muted">
        <span>운영실</span>
        <span className="text-faint">/</span>
        <span>인증</span>
        <span className="text-faint">/</span>
        <strong className="font-semibold text-ink">비밀번호 찾기</strong>
      </nav>

      <h2 className="mb-2 text-2xl font-semibold tracking-[-0.02em]">
        비밀번호 찾기{" "}
        <em className="not-italic font-normal text-vermilion mx-[0.1em]">—</em>{" "}
        운영부
      </h2>
      <p className="mb-6 text-sm leading-[1.6] text-muted">
        가입 이메일을 입력하면 재설정 링크를 보내드립니다. 메일이 안 오면 스팸함도 확인해주세요.
      </p>

      <form action={formAction} noValidate className="flex flex-col gap-4">
        {state?.error && (
          <div role="alert" className="border border-vermilion bg-vermilion/10 px-3 py-2 text-xs text-vermilion">
            {state.error}
          </div>
        )}
        {state?.info && (
          <div role="status" className="border border-sage bg-sage/10 px-3 py-2 text-xs text-sage">
            {state.info}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label
            htmlFor="email"
            className="text-xs font-medium uppercase tracking-[0.06em] text-muted"
          >
            이메일
          </label>
          <div className="relative border-b border-ink transition-colors duration-100 focus-within:border-vermilion">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="yss@opsroom.local"
              className="w-full border-none bg-transparent py-3 text-md tracking-[-0.005em] text-ink outline-none placeholder:text-faint [line-height:normal]"
            />
          </div>
        </div>

        <SubmitButton />
      </form>

      <Link
        href="/login"
        className="mt-6 inline-flex items-center text-sm tracking-[0.02em] text-muted no-underline transition-colors hover:text-vermilion min-h-[var(--tap-min)]"
      >
        ← 로그인으로 돌아가기
      </Link>
    </AuthShell>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 border border-ink bg-ink px-5 text-md tracking-[0.04em] text-cream transition-colors duration-150 hover:border-vermilion hover:bg-vermilion active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 min-h-12"
    >
      {pending ? "발송 중…" : "재설정 링크 발송"}
    </button>
  );
}
```

- [ ] **Step 2: tsc + lint 회귀**

Run: `npx tsc --noEmit && npm run lint 2>&1 | tail -5`
Expected: tsc 0, lint 0 errors

- [ ] **Step 3: 수동 동작 확인 (dev)**

dev server에서 `http://localhost:3001/forgot-password` 진입:
Expected: 200 OK, TitleBar(시계) + 폼 + StatusBar 렌더, "← 로그인으로 돌아가기" 링크 노출.

- [ ] **Step 4: 체크포인트**

```
Task 9 완료 — /forgot-password 페이지
- AuthShell 사용 ✓
- forgotPassword Server Action 연결 ✓
- 시각 확인 (dev) 200 OK ✓
- tsc 0, lint 0
```

---

## Task 10: /reset-password 페이지 (가드 + 인디케이터 재사용)

새 비밀번호 입력 폼. 임시 session 가드 + 강도/일치 인디케이터(`/login` page.tsx에서 추출 또는 중복 정의).

**Files:**
- Create: `src/app/reset-password/page.tsx`

- [ ] **Step 1: 디렉터리 + 파일 생성**

```bash
mkdir -p src/app/reset-password
```

`src/app/reset-password/page.tsx`:

```tsx
"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { resetPassword, type AuthState } from "@/features/auth/actions";
import { AuthShell } from "@/components/auth/AuthShell";

type GuardState = "checking" | "ok" | "no-session";

export default function ResetPasswordPage() {
  const [guard, setGuard] = useState<GuardState>("checking");
  const [state, formAction] = useActionState<AuthState, FormData>(
    resetPassword,
    undefined
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showCfm, setShowCfm] = useState(false);

  useEffect(() => {
    // 임시 session 가드 — /auth/callback을 거친 경우에만 user가 있음.
    // 이미 로그인된 사용자도 user가 있으므로 통과 (의도된 동작 — 그대로 허용).
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.auth.getUser().then(({ data, error }) => {
      setGuard(error || !data.user ? "no-session" : "ok");
    });
  }, []);

  if (guard === "checking") {
    return (
      <AuthShell>
        <p className="text-sm text-muted">세션 확인 중…</p>
      </AuthShell>
    );
  }

  if (guard === "no-session") {
    return (
      <AuthShell>
        <h2 className="mb-2 text-2xl font-semibold tracking-[-0.02em]">잘못된 접근입니다</h2>
        <p className="mb-6 text-sm leading-[1.6] text-muted">
          비밀번호 재설정 링크가 만료됐거나 직접 진입하셨습니다. 비밀번호 찾기를 다시 시도해주세요.
        </p>
        <Link
          href="/forgot-password"
          className="inline-flex items-center text-sm tracking-[0.02em] text-vermilion no-underline transition-colors hover:underline min-h-[var(--tap-min)]"
        >
          비밀번호 찾기로 가기 →
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <nav className="mb-5 flex items-center gap-2 text-xs tracking-[0.04em] text-muted">
        <span>운영실</span>
        <span className="text-faint">/</span>
        <span>인증</span>
        <span className="text-faint">/</span>
        <strong className="font-semibold text-ink">비밀번호 재설정</strong>
      </nav>

      <h2 className="mb-2 text-2xl font-semibold tracking-[-0.02em]">새 비밀번호 설정</h2>
      <p className="mb-6 text-sm leading-[1.6] text-muted">
        안전한 새 비밀번호를 입력하세요. 변경 후 자동으로 로그인됩니다.
      </p>

      <form action={formAction} noValidate className="flex flex-col gap-4">
        {state?.error && (
          <div role="alert" className="border border-vermilion bg-vermilion/10 px-3 py-2 text-xs text-vermilion">
            {state.error}
          </div>
        )}
        <div>
          <Field
            id="password"
            label="비밀번호"
            type={showPw ? "text" : "password"}
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            trailing={
              <ToggleButton pressed={showPw} onClick={() => setShowPw((s) => !s)} ariaLabel="비밀번호 표시/숨김" />
            }
          />
          <PasswordStrengthIndicator value={password} />
        </div>
        <div>
          <Field
            id="passwordConfirm"
            label="비밀번호 확인"
            type={showCfm ? "text" : "password"}
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            trailing={
              <ToggleButton pressed={showCfm} onClick={() => setShowCfm((s) => !s)} ariaLabel="비밀번호 확인 표시/숨김" />
            }
          />
          <PasswordMatchIndicator pw={password} confirm={confirm} />
        </div>
        <SubmitButton />
      </form>
    </AuthShell>
  );
}

type FieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "className"> & {
  id: string;
  label: string;
  trailing?: React.ReactNode;
};

function Field({ id, label, trailing, ...inputProps }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-xs font-medium uppercase tracking-[0.06em] text-muted"
      >
        {label}
      </label>
      <div className="relative border-b border-ink transition-colors duration-100 focus-within:border-vermilion">
        <input
          id={id}
          name={id}
          {...inputProps}
          className="w-full border-none bg-transparent py-3 text-md tracking-[-0.005em] text-ink outline-none placeholder:text-faint [line-height:normal]"
        />
        {trailing}
      </div>
    </div>
  );
}

function ToggleButton({
  pressed,
  onClick,
  ariaLabel,
}: {
  pressed: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={pressed}
      onClick={onClick}
      className="absolute right-0 top-1/2 -translate-y-1/2 cursor-pointer p-2 text-xs tracking-[0.06em] text-muted transition-colors hover:text-ink min-h-[var(--tap-min)]"
    >
      {pressed ? "숨김" : "표시"}
    </button>
  );
}

function PasswordStrengthIndicator({ value }: { value: string }) {
  const checks = [
    { label: "영문 대문자 포함", ok: /[A-Z]/.test(value) },
    { label: "숫자 포함", ok: /[0-9]/.test(value) },
    {
      label: "특수문자 포함",
      ok: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/.test(value),
    },
    { label: "8자 이상", ok: value.length >= 8 },
  ];
  return (
    <ul className="mt-1 flex flex-col gap-0.5 text-xs">
      {checks.map((c) => (
        <li key={c.label} className={c.ok ? "text-sage" : "text-muted"}>
          <span className="mr-1">{c.ok ? "✓" : "✗"}</span>
          {c.label}
        </li>
      ))}
    </ul>
  );
}

function PasswordMatchIndicator({ pw, confirm }: { pw: string; confirm: string }) {
  if (!confirm) return null;
  const ok = pw === confirm;
  return (
    <div className={`mt-1 text-xs ${ok ? "text-sage" : "text-vermilion"}`}>
      <span className="mr-1">{ok ? "✓" : "✗"}</span>
      {ok ? "비밀번호와 일치" : "비밀번호와 다름"}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 border border-ink bg-ink px-5 text-md tracking-[0.04em] text-cream transition-colors duration-150 hover:border-vermilion hover:bg-vermilion active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 min-h-12"
    >
      {pending ? "변경 중…" : "비밀번호 변경"}
    </button>
  );
}
```

- [ ] **Step 2: tsc + lint 회귀**

Run: `npx tsc --noEmit && npm run lint 2>&1 | tail -5`
Expected: tsc 0, lint 0 errors

- [ ] **Step 3: 수동 동작 확인 (dev)**

dev server에서 `http://localhost:3001/reset-password` 직접 진입 (token 없이):
Expected: 200 OK + 가드 안내 ("잘못된 접근입니다") + "비밀번호 찾기로 가기 →" 링크.

- [ ] **Step 4: 체크포인트**

```
Task 10 완료 — /reset-password 페이지
- AuthShell + 가드 + 강도/일치 인디케이터 + ToggleButton ✓
- 가드: 임시 session 없으면 안내 + /forgot-password 링크 ✓
- tsc 0, lint 0
```

---

## Task 11: /login 갱신 — SSO 활성 + 비밀번호 찾기 링크 + remember controlled + error 파라미터

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: 현재 page.tsx의 SSOButton, SignInForm, LoginPage 구조 확인**

Run: `grep -n "function SSOButton\|function SignInForm\|export default function LoginPage" src/app/login/page.tsx`

- [ ] **Step 2: LoginPage에 error 파라미터 처리 + LoginPage 본문 갱신**

`src/app/login/page.tsx`의 import 라인에 `useSearchParams` 추가 (next/navigation):

```ts
import { useSearchParams } from "next/navigation";
```

`LoginPage` 본문 시작 부분에 추가 (mode/email state 옆):

```tsx
const searchParams = useSearchParams();
const errorParam = searchParams.get("error");
const errorMessage =
  errorParam === "oauth_failed"
    ? "Microsoft 인증에 실패했습니다."
    : errorParam === "missing_code"
      ? "인증 응답에 오류가 있습니다."
      : errorParam === "exchange_failed"
        ? "세션 발급에 실패했습니다."
        : undefined;
```

`<AuthPanel ...>` 호출에 `oauthError={errorMessage}` 추가.

- [ ] **Step 3: AuthPanel signature에 oauthError prop 추가**

AuthPanel signature를 다음으로:

```tsx
function AuthPanel({
  mode,
  setMode,
  email,
  setEmail,
  showPassword,
  onToggle,
  oauthError,
}: {
  mode: "signin" | "signup";
  setMode: (m: "signin" | "signup") => void;
  email: string;
  setEmail: (v: string) => void;
  showPassword: boolean;
  onToggle: () => void;
  oauthError: string | undefined;
}) {
```

mode 분기에서 SignInForm 호출에 `oauthError={oauthError}` 추가:

```tsx
{mode === "signin" ? (
  <SignInForm email={email} setEmail={setEmail} showPassword={showPassword} onToggle={onToggle} oauthError={oauthError} />
) : (
  <SignUpForm email={email} setEmail={setEmail} />
)}
```

- [ ] **Step 4: SignInForm 갱신 — oauthError 표시 + remember controlled + 비밀번호 찾기 링크**

SignInForm signature 갱신:

```tsx
function SignInForm({
  email,
  setEmail,
  showPassword,
  onToggle,
  oauthError,
}: {
  email: string;
  setEmail: (v: string) => void;
  showPassword: boolean;
  onToggle: () => void;
  oauthError: string | undefined;
}) {
  const [state, formAction] = useActionState<AuthState, FormData>(signIn, undefined);
  const [remember, setRemember] = useState(true);
```

remember 체크박스 부분을 controlled로 갱신:

```tsx
<input
  type="checkbox"
  name="remember"
  checked={remember}
  onChange={(e) => setRemember(e.target.checked)}
  className="relative h-3.5 w-3.5 flex-shrink-0 cursor-pointer appearance-none border border-line bg-transparent checked:bg-ink checked:after:absolute checked:after:left-1/2 checked:after:top-1/2 checked:after:-translate-x-1/2 checked:after:-translate-y-[52%] checked:after:text-[11px] checked:after:leading-none checked:after:text-cream checked:after:content-['✓']"
/>
```

(`defaultChecked` 제거하고 `checked` + `onChange`로 controlled.)

비밀번호 찾기 링크의 `href="#"`를 `href="/forgot-password"`로 변경. `<a>`를 next/link `Link`로 교체:

```tsx
import Link from "next/link";
// ... 
<Link
  href="/forgot-password"
  className="inline-flex items-center text-sm tracking-[0.02em] text-muted no-underline transition-colors hover:text-vermilion min-h-[var(--tap-min)]"
>
  비밀번호 찾기 →
</Link>
```

(SignInForm 안의 기존 `<a href="#">비밀번호 찾기 →</a>` 부분 교체)

error alert 표시 부분에 oauthError 추가 — 기존 `state?.error` alert 위에 oauthError alert 추가:

```tsx
{oauthError && (
  <div role="alert" className="border border-vermilion bg-vermilion/10 px-3 py-2 text-xs text-vermilion">
    {oauthError}
  </div>
)}
{state?.error && (
  <div role="alert" className="border border-vermilion bg-vermilion/10 px-3 py-2 text-xs text-vermilion">
    {state.error}
  </div>
)}
```

- [ ] **Step 5: SSOButton 활성화 + onClick handler**

기존 SSOButton 함수를 다음으로 교체:

```tsx
function SSOButton() {
  const handleSSO = async () => {
    const { createBrowserClient } = await import("@supabase/ssr");
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <button
      type="button"
      onClick={handleSSO}
      aria-label="Microsoft SSO로 계속"
      className="inline-flex w-full cursor-pointer items-center justify-center gap-3 border border-ink bg-transparent px-5 text-md tracking-[0.02em] text-ink min-h-12 [box-shadow:0_1px_0_rgba(21,18,12,0.04)] hover:border-vermilion hover:text-vermilion active:translate-y-px"
    >
      <span
        aria-hidden
        className="grid h-4 w-4 flex-shrink-0 grid-cols-2 grid-rows-2 gap-px"
      >
        {/* Microsoft 공식 4색 — 외부 브랜드 색이라 토큰화 불가 (일회성) */}
        <span className="bg-[#f25022]" />
        <span className="bg-[#7fba00]" />
        <span className="bg-[#00a4ef]" />
        <span className="bg-[#ffb900]" />
      </span>
      <span>Microsoft SSO로 계속</span>
    </button>
  );
}
```

(disabled, opacity-60, cursor-not-allowed, title 속성 모두 제거. hover/active 스타일 추가.)

- [ ] **Step 6: tsc + lint 회귀**

Run: `npx tsc --noEmit && npm run lint 2>&1 | tail -5`
Expected: tsc 0, lint 0 errors

- [ ] **Step 7: tsc + lint + Vitest 회귀 (e2e는 Task 13에서 한 번에)**

```bash
npx tsc --noEmit && npm run lint 2>&1 | tail -5 && npm test 2>&1 | tail -5
```

Expected: tsc 0, lint 0 errors, Vitest 22/22.

(e2e는 Task 13에서 SSO 시나리오 갱신과 함께 한 번에 실행 — 여기서 돌리면 기존 "SSO disabled" 시나리오와 충돌해 fail 가능)

- [ ] **Step 8: 체크포인트**

```
Task 11 완료 — /login 갱신
- SSOButton 활성화 + signInWithOAuth onClick ✓
- "비밀번호 찾기 →" → /forgot-password Link ✓
- remember controlled (default true) ✓
- error 파라미터 → oauthError alert ✓
- e2e 회귀: SSO disabled 검증 외 0 failed
```

---

## Task 12: mockup design-sync 검증

mockup `folio-login.html`의 SSO 버튼은 이미 enabled 상태(`<button type="button" class="btn-sso primary-sso" onclick="...">`, line 785). React 변경(Task 11)으로 SSO 버튼이 enabled 되면 자동 align — mockup 변경 0. design-sync로 alignment 측정만.

**Files:**
- Reference (no edit): `design-ref/folio-login.html`

- [ ] **Step 1: mockup의 SSO 버튼 enabled 상태 재확인**

Run: `grep -n "btn-sso" design-ref/folio-login.html`
Expected: line 785 부근 `<button type="button" class="btn-sso primary-sso">`. `disabled` 속성 없음 ✓.

- [ ] **Step 2: design-sync 측정**

```bash
LOCAL_BASE=http://localhost:3001 npm run design-sync 2>&1 | tail -10
```

Expected: login desktop 99.3% 부근 유지 (React SSOButton의 hover/active 스타일 변경으로 미세한 변동 가능, ≥ 96% 허용).

- [ ] **Step 3: 체크포인트**

```
Task 12 완료 — mockup design-sync 검증
- mockup SSO 버튼은 이미 enabled — 변경 0
- design-sync login desktop: __%
```

---

## Task 13: e2e — 신규 spec 2개 + login.spec.ts 갱신

**Files:**
- Create: `e2e/forgot-password.spec.ts`
- Create: `e2e/reset-password.spec.ts`
- Modify: `e2e/login.spec.ts`

- [ ] **Step 1: e2e/login.spec.ts 갱신**

먼저 SSO disabled 시나리오 식별:
Run: `grep -n "Microsoft SSO" e2e/login.spec.ts`

기존 "Microsoft SSO 버튼은 disabled" 시나리오를 다음으로 교체:

```ts
test("Microsoft SSO 버튼은 활성 — onClick으로 OAuth 시작", async ({ page }) => {
  const sso = page.getByRole("button", { name: /Microsoft SSO로 계속/ });
  await expect(sso).toBeEnabled();
});
```

(disabled 검증 → enabled 검증으로 변경. 실제 redirect는 외부 의존이라 검증 X.)

기존 describe 안 (또는 끝)에 다음 두 시나리오 추가:

```ts
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
```

- [ ] **Step 2: e2e/forgot-password.spec.ts 작성**

```ts
import { test, expect } from "@playwright/test";

test.describe("/forgot-password", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/forgot-password");
  });

  test("페이지 렌더 + 핵심 카피 노출", async ({ page }) => {
    await expect(page.getByText("비밀번호 찾기 — 운영부")).toBeVisible();
    await expect(page.getByText("← 로그인으로 돌아가기")).toBeVisible();
  });

  test("빈 이메일 제출 시 zod 에러", async ({ page }) => {
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByText("이메일을 입력해주세요.")).toBeVisible();
  });

  test("이메일 형식 잘못되면 zod 에러", async ({ page }) => {
    await page.fill('input[name="email"]', "not-an-email");
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByText("이메일 형식이 올바르지 않습니다.")).toBeVisible();
  });

  test("정상 이메일 제출 시 info alert (TEST_USER 미설정 시 skip)", async ({ page }) => {
    test.skip(
      !process.env.TEST_USER_EMAIL,
      "TEST_USER_EMAIL 미설정 — 실제 Supabase 호출 필요"
    );
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
    await page.locator('form button[type="submit"]').click();
    await expect(
      page.getByText("재설정 링크를 발송했습니다. 메일함을 확인해주세요.")
    ).toBeVisible({ timeout: 10000 });
  });

  test("← 로그인으로 돌아가기 클릭 시 /login으로 이동", async ({ page }) => {
    await page.getByText("← 로그인으로 돌아가기").click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
```

- [ ] **Step 3: e2e/reset-password.spec.ts 작성**

```ts
import { test, expect } from "@playwright/test";

test.describe("/reset-password", () => {
  test("token 없이 직접 진입 시 가드 안내", async ({ page }) => {
    await page.goto("/reset-password");
    // 비로그인 컨텍스트는 middleware가 통과(PUBLIC_PATHS) → 페이지 마운트 후 getUser() = no-session
    await expect(page.getByText("잘못된 접근입니다")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("비밀번호 찾기로 가기 →")).toBeVisible();
  });

  test("가드 통과 후 강도 인디케이터 동작 (TEST_USER 미설정 시 skip)", async ({ page }) => {
    test.skip(
      !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
      "TEST_USER 미설정 — 일반 로그인으로 user 생성 후 reset-password 진입"
    );
    // 일반 로그인으로 user 만들기 (이미 로그인된 사용자 진입은 그대로 허용 — 가드 통과)
    await page.goto("/login");
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard$/);

    await page.goto("/reset-password");
    await expect(page.getByText("새 비밀번호 설정")).toBeVisible({ timeout: 5000 });
    await page.locator('input[name="password"]').fill("Aa1!aaaa");
    await expect(page.getByText("영문 대문자 포함")).toHaveClass(/text-sage/);
    await expect(page.getByText("8자 이상")).toHaveClass(/text-sage/);
  });
});
```

- [ ] **Step 4: e2e 실행**

```bash
PID=$(cat /tmp/folio-dev-3001.pid 2>/dev/null); kill "$PID" 2>/dev/null; sleep 2
npm run test:e2e 2>&1 | tail -15
```

Expected: 약 60+ passed / ~17 skipped / 0 failed (52 기존 + ~10 신규 across 2 browsers).

- [ ] **Step 5: dev server 재기동**

```bash
PATH=/usr/local/bin:/usr/bin:/bin:$PATH npx next dev -p 3001 > /tmp/folio-dev-3001.log 2>&1 &
echo $! > /tmp/folio-dev-3001.pid
sleep 4
```

- [ ] **Step 6: 체크포인트**

```
Task 13 완료 — e2e 신규 + 기존 갱신
- login.spec.ts: SSO enabled 검증 + 비밀번호 찾기 라우팅 + remember controlled
- forgot-password.spec.ts: 5 시나리오
- reset-password.spec.ts: 2 시나리오
- 회귀 0 failed
```

---

## Task 14: 종합 검증 + 메모리 + 사용자 시각 검증 안내

**Files:**
- Create: `/Users/yss/.claude/projects/-Users-yss----build-Folio/memory/feedback_login_extras_pattern.md`
- Modify: `/Users/yss/.claude/projects/-Users-yss----build-Folio/memory/MEMORY.md`

- [ ] **Step 1: 종합 검증 (한 번에)**

```bash
npx tsc --noEmit
npm run lint 2>&1 | tail -5
npm test 2>&1 | tail -10
LOCAL_BASE=http://localhost:3001 npm run design-sync 2>&1 | tail -10
```

Expected:
- tsc / lint exit 0
- Vitest 22/22 pass
- design-sync login desktop ≥ 96%

- [ ] **Step 2: 메모리 작성**

`/Users/yss/.claude/projects/-Users-yss----build-Folio/memory/feedback_login_extras_pattern.md`:

```markdown
---
name: SSO + remember 14일 + 비밀번호 찾기 패턴
description: Supabase OAuth + cookie maxAge override + reset password 흐름 + /auth/callback route handler
type: feedback
---

Folio /login extras plan(2026-04-26)에서 SSO + remember + 비밀번호 찾기 추가 시 발견한 재사용 가능 패턴.

## Cookie maxAge override (이 기기 기억)

Supabase ssr `createServerClient`의 cookies setAll callback에서 maxAge를 정책에 따라 override:

```ts
export async function createClient(options?: { rememberMe?: boolean }) {
  const cookieStore = await cookies();
  return createServerClient(URL, KEY, {
    cookies: {
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options: cookieOptions }) => {
          const finalOptions =
            options?.rememberMe === true
              ? { ...cookieOptions, maxAge: 14 * 24 * 3600 }
              : options?.rememberMe === false
                ? { ...cookieOptions, maxAge: undefined }
                : cookieOptions;
          cookieStore.set(name, value, finalOptions);
        });
      },
      getAll() { return cookieStore.getAll(); },
    },
  });
}
```

**Why:** "이 기기 기억" 체크박스 동작을 cookie 만료 시간으로 표현. 미체크 = session cookie(브라우저 닫으면 만료).
**How to apply:** 다른 도메인에서도 "이 기기 기억" / "자동 로그인" 같은 정책 만들 때 같은 패턴.

## /auth/callback route handler

OAuth code 교환 + next 파라미터로 redirect 분기. SSO와 비밀번호 reset 두 흐름의 단일 진입점.

```ts
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  // ... exchangeCodeForSession + redirect
}
```

**How to apply:** Supabase 다른 OAuth provider (Google, GitHub 등) 추가 시 동일 callback 재사용.

## resetPasswordForEmail enumeration 방지

가입 여부와 무관하게 동일 info 반환:
```ts
await supabase.auth.resetPasswordForEmail(email, { redirectTo });
return { info: "재설정 링크를 발송했습니다. 메일함을 확인해주세요." };
```

미가입 이메일이라도 같은 메시지 — 이메일 enumeration 공격 방지.

**Why:** 보안 베스트 프랙티스. **How to apply:** 비밀번호 reset / 가입 확인 / 계정 검색 등 모든 이메일 input 흐름에 적용.

## SSO 버튼 클라이언트 호출

OAuth signIn은 클라이언트(브라우저)에서 호출 — Server Action 아님. signInWithOAuth가 브라우저 redirect를 트리거하기 때문.

```tsx
const handleSSO = async () => {
  const supabase = createBrowserClient(URL, KEY);
  await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
};
```

**How to apply:** SSO/OAuth 버튼은 항상 클라이언트 컴포넌트 + onClick handler.

## 임시 session 가드 (reset-password 페이지)

`createBrowserClient` + `getUser()`로 마운트 시 session 체크. 이미 로그인된 사용자도 user가 있으니 통과 (의도된 동작).

```tsx
useEffect(() => {
  const supabase = createBrowserClient(URL, KEY);
  supabase.auth.getUser().then(({ data, error }) => {
    setGuard(error || !data.user ? "no-session" : "ok");
  });
}, []);
```

**How to apply:** 임시 session 의존 페이지 (이메일 확인, OAuth 재인증 등).
```

- [ ] **Step 3: MEMORY.md 인덱스 추가**

`/Users/yss/.claude/projects/-Users-yss----build-Folio/memory/MEMORY.md` 적절 위치에 한 줄 추가:

```markdown
- [SSO + remember 14일 + 비밀번호 찾기 패턴](feedback_login_extras_pattern.md) — Supabase OAuth + cookie maxAge override + reset 흐름 + /auth/callback
```

- [ ] **Step 4: 최종 체크포인트 + 사용자 시각 검증 안내**

```
Login extras plan 완료.

산출물:
- 신규 6 파일: /auth/callback/route.ts, AuthShell.tsx, /forgot-password/page.tsx, /reset-password/page.tsx, e2e 2 spec
- 수정 8 파일: server.ts, schemas.ts, actions.ts, actions.test.ts, middleware.ts, /login/page.tsx, mockup, e2e/login.spec.ts
- 메모리: feedback_login_extras_pattern.md

검증 결과:
- tsc/lint exit 0
- Vitest 22/22
- Playwright ~62 passed / 0 failed
- design-sync login desktop ≥ 96%

브라우저 시각 검증 부탁드립니다:
1. /login → "Microsoft SSO로 계속" 클릭 → login.microsoftonline.com 페이지로 redirect → Microsoft 인증 → /dashboard 자동 이동
2. /login → email/password 입력 + "이 기기 기억 14일" 체크 후 로그인 → DevTools → Application → Cookies → supabase auth cookie의 Expires가 14일 후 ✓
   /login → email/password 입력 + 체크 해제 후 로그인 → Cookies의 Expires가 "Session" ✓
3. /login → "비밀번호 찾기 →" 클릭 → /forgot-password 진입 → 본인 이메일 입력 → 메일함 확인 → 링크 클릭 → /reset-password 진입 → 새 비밀번호 입력 → /dashboard 자동 이동
4. /login?error=oauth_failed 직접 진입 → "Microsoft 인증에 실패했습니다." vermilion alert ✓

다음 후보: Dashboard reconstruction brainstorm (별도 세션 권장 — 컨텍스트 큼).
```
