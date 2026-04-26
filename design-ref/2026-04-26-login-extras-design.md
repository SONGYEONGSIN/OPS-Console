# Login Extras Design (2026-04-26)

> Folio /login에 (1) Microsoft SSO 활성화, (2) "이 기기 기억 14일" 체크박스 동작, (3) 비밀번호 찾기(/forgot-password + /reset-password) 추가.

---

## 1. 배경 / 결정사항

### 배경
- Login features plan(2026-04-26)으로 self-signup, 비밀번호 강도/일치 인디케이터, 실시간 시계가 추가됐다.
- 현재 SSO는 disabled, "이 기기 기억"은 시각만 있는 placebo, "비밀번호 찾기 →"는 더미 링크.
- 사용자 요청: 세 기능을 실제 동작하게 만들기.

### 결정사항

| # | 항목 | 결정 | 근거 |
|---|------|------|------|
| 1 | SSO 환경 | Azure AD app registration + Supabase Azure provider 셋업 완료 | 사용자 사전 확인 |
| 2 | SSO 흐름 | `signInWithOAuth({ provider: 'azure' })` → Microsoft 로그인 → `/auth/callback` route handler가 `exchangeCodeForSession` → /dashboard | Supabase Next.js SSR 표준 |
| 3 | SSO 스코프 | 기본(`email`) | YAGNI — 이름/사진 필요해지면 확장 |
| 4 | 14일 기억 | 체크 시 cookie maxAge=14일, 미체크 시 session cookie (브라우저 닫으면 만료) | "이 기기 기억"의 직관 + 공용 단말 안전 |
| 5 | 비밀번호 찾기 라우팅 | `/forgot-password` (이메일 입력) + `/reset-password` (새 비밀번호 입력) 두 페이지 | 표준 흐름 + 외부 메일 링크 진입 자연스러움 |
| 6 | reset 후 동작 | 자동 로그인 → /dashboard | UX 마찰 최소 + 메일 인증으로 본인 확인 충분 |
| 7 | forgot/reset layout | TitleBar + 중앙 정렬 폼(`max-w-[420px]`) + StatusBar (BrandPanel 제거) | 짧은 transactional 흐름에 BrandPanel 과함 |
| 8 | `/reset-password`에 이미 로그인된 사용자 진입 | 그대로 허용 (Supabase가 임시 session으로 대체) | 설계 단순 |

---

## 2. 아키텍처

### (1) Microsoft SSO

```
[사용자] "Microsoft SSO로 계속" 클릭
  → SignInForm: supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: { redirectTo: ${origin}/auth/callback }
     })
  → 브라우저 redirect → login.microsoftonline.com
  → 사용자 인증 완료 → Supabase callback URL로 ?code=... 첨부 redirect
  → Supabase → 우리 앱의 /auth/callback?code=...
  → /auth/callback route handler:
        supabase.auth.exchangeCodeForSession(code)
        → cookie set → /dashboard redirect
```

### (2) 이 기기 기억 14일

```
[사용자] signin 폼에서 remember 체크 + 제출
  → signIn Server Action:
        formData.get("remember") === "on" → boolean
        const supabase = await createClient({ rememberMe: <boolean> })
        await supabase.auth.signInWithPassword(...)
  → server.ts createClient의 cookies.setAll callback에서 maxAge override:
        체크 시 → maxAge = 14 * 24 * 3600
        미체크 시 → maxAge undefined (session cookie)
  → /dashboard redirect
```

### (3) 비밀번호 찾기

```
[/login] "비밀번호 찾기 →" 클릭 → /forgot-password
[/forgot-password] 이메일 입력 + 제출
  → forgotPassword Server Action:
        supabase.auth.resetPasswordForEmail(email, {
          redirectTo: ${origin}/auth/callback?next=/reset-password
        })
  → "재설정 링크를 발송했습니다." sage info alert
[메일] 사용자가 링크 클릭
  → Supabase → /auth/callback?code=...&next=/reset-password
  → /auth/callback이 code 교환 → /reset-password로 redirect (임시 session 활성)
[/reset-password] 새 비밀번호 + 확인 + 제출
  → resetPassword Server Action: supabase.auth.updateUser({ password })
  → session 그대로 active → /dashboard redirect
```

### 공통 인프라
- `/auth/callback` route handler 신규 — SSO와 비밀번호 reset 두 흐름의 진입점 (`next` 파라미터로 분기)
- `middleware.ts`의 `PUBLIC_PATHS` 확장: `/login`, `/forgot-password`, `/reset-password`, `/auth/callback`

---

## 3. 컴포넌트 / 파일 구조

### 신규 파일

| 파일 | 역할 |
|------|------|
| `src/app/auth/callback/route.ts` | OAuth code 교환 + `next` 파라미터로 redirect 분기 (route handler) |
| `src/app/forgot-password/page.tsx` | 이메일 입력 폼 (TitleBar + 중앙 폼 + StatusBar) |
| `src/app/reset-password/page.tsx` | 새 비밀번호 입력 폼 (동일 layout) |
| `src/components/auth/AuthShell.tsx` | TitleBar + 중앙 폼 + StatusBar 공통 셸. forgot/reset 두 페이지 공유 |
| `e2e/forgot-password.spec.ts` | /forgot-password 시나리오 |
| `e2e/reset-password.spec.ts` | /reset-password 시나리오 |

### 수정 파일

| 파일 | 변경 |
|------|------|
| `src/features/auth/schemas.ts` | `forgotPasswordSchema` (email), `resetPasswordSchema` (signUpSchema에서 email 분리한 password+passwordConfirm+강도) 추가 |
| `src/features/auth/actions.ts` | `forgotPassword`, `resetPassword` Server Actions 추가. `signIn`에 remember 옵션 cookie maxAge 로직 |
| `src/features/auth/actions.test.ts` | 신규 actions 10 케이스 추가 |
| `src/lib/supabase/server.ts` | `createClient`에 `rememberMe?: boolean` 옵션 추가 + cookie maxAge override |
| `src/app/login/page.tsx` | SSOButton enabled + onClick → `signInWithOAuth`. SignInForm "비밀번호 찾기 →" href를 `/forgot-password`로. remember 체크박스 controlled |
| `src/middleware.ts` | PUBLIC_PATHS 확장 |
| `e2e/login.spec.ts` | SSO 버튼 enabled 검증, 비밀번호 찾기 라우팅 검증, remember controlled 동작 |
| `design-ref/folio-login.html` | SSO 버튼 disabled 표시 제거 (mockup 동기화) |

### 참조 (수정 없음)
`lib/supabase/{client,middleware}.ts`, `design-tokens.ts`, `globals.css`, `dashboard/*`

### 파일 수
신규 6 + 수정 8 (mockup 1 포함) = 14 → HARD-GATE 6~19개 → **간략 설계** 등급. (이 design.md + 후속 plan으로 충족)

---

## 4. UX

### (1) `/login` SSOButton 동작 변화
- `disabled` 제거, `opacity-60` 제거 → 정상 클릭 가능
- onClick → `signInWithOAuth({ provider: 'azure', options: { redirectTo: ${origin}/auth/callback } })` → 즉시 Microsoft 로그인 페이지로 redirect
- title 속성("준비 중") 제거
- mockup HTML 동기화

### (2) `/login` remember 체크박스
- 시각 변경 0
- controlled 전환: `const [remember, setRemember] = useState(true);` (default checked 유지)
- formData에 `name="remember"` 자동 포함 → Server Action이 cookie 정책 결정

### (3) `/forgot-password` 페이지 (텍스트 wireframe)
```
[TitleBar: 운영부 · 로그인 OPSROOM | 시계]

           ╭──────────────────────────────╮
           │  비밀번호 찾기 — 운영부          │
           │                              │
           │  가입 이메일을 입력하면          │
           │  재설정 링크를 보내드립니다.       │
           │                              │
           │  [error or info alert]        │
           │                              │
           │  이메일                        │
           │  ┌──────────────────────┐    │
           │  │ yss@opsroom.local    │    │
           │  └──────────────────────┘    │
           │                              │
           │  [재설정 링크 발송]              │
           │                              │
           │  ← 로그인으로 돌아가기            │
           ╰──────────────────────────────╯

[StatusBar: 연결됨 · 서버 · 빌드]
```
- Form 폭 `max-w-[420px]`
- 제출 후 success: "재설정 링크를 발송했습니다. 메일함을 확인해주세요." sage info alert
- 미가입 이메일이라도 동일 메시지 (enumeration 방지)

### (4) `/reset-password` 페이지
```
[TitleBar: 운영부 · 로그인 OPSROOM | 시계]

           ╭──────────────────────────────╮
           │  새 비밀번호 설정                │
           │                              │
           │  안전한 새 비밀번호를 입력하세요.   │
           │                              │
           │  비밀번호                       │
           │  ┌──────────────────────┐    │
           │  │ ••••••••              │    │
           │  └──────────────────────┘    │
           │  ✓ 영문 대문자 포함              │
           │  ✓ 숫자 포함                    │
           │  ✓ 특수문자 포함                │
           │  ✓ 8자 이상                    │
           │                              │
           │  비밀번호 확인                   │
           │  ┌──────────────────────┐    │
           │  │ ••••••••              │    │
           │  └──────────────────────┘    │
           │  ✓ 비밀번호와 일치               │
           │                              │
           │  [비밀번호 변경]                │
           ╰──────────────────────────────╯

[StatusBar]
```
- 비밀번호 강도 / 일치 인디케이터는 SignUpForm과 동일 컴포넌트 재사용 (`PasswordStrengthIndicator`, `PasswordMatchIndicator`)
- 제출 성공 → /dashboard
- 임시 session 없이 직접 진입 시: "잘못된 접근입니다. 비밀번호 찾기를 다시 시도하세요." + `/forgot-password` 링크

---

## 5. 데이터 흐름 / Server Actions 상세

### `signIn` 갱신
```ts
export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signInSchema.safeParse({...});
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const remember = formData.get("remember") === "on";
  const supabase = await createClient({ rememberMe: remember });
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
```

### `lib/supabase/server.ts` 갱신
```ts
export async function createClient(options?: { rememberMe?: boolean }) {
  const cookieStore = await cookies();
  return createServerClient(URL, KEY, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
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
    },
  });
}
```
호환성: `rememberMe` 미지정 시 Supabase 기본 동작 그대로 (middleware, dashboard 등 기존 호출자 영향 없음).

### SSO — 클라이언트 호출
```tsx
const handleSSO = async () => {
  const supabase = createBrowserClient(URL, KEY);
  await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
};
```

### `/auth/callback` Route Handler
```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const oauthError = searchParams.get("error");

  if (oauthError) return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  return NextResponse.redirect(`${origin}${next}`);
}
```

### `forgotPassword` Server Action
```ts
export async function forgotPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  // 보안: 가입 여부 enumeration 방지 — 에러 결과와 무관하게 동일 info 반환
  return { info: "재설정 링크를 발송했습니다. 메일함을 확인해주세요." };
}
```

### `resetPassword` Server Action
```ts
export async function resetPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
```

### `/login?error=...` 처리
LoginPage가 search params로 `error` 받으면 SignInForm에 표시:
- `oauth_failed` → "Microsoft 인증에 실패했습니다."
- `missing_code` → "인증 응답에 오류가 있습니다."
- `exchange_failed` → "세션 발급에 실패했습니다."

### Schemas 추가
```ts
// schemas.ts
export const forgotPasswordSchema = z.object({
  email: z.string().min(1, "이메일을 입력해주세요.").email("이메일 형식이 올바르지 않습니다."),
});

export const resetPasswordSchema = z
  .object({
    password: z.string()
      .min(8, "비밀번호는 8자 이상이어야 합니다.")
      .regex(/[A-Z]/, "영문 대문자를 포함해야 합니다.")
      .regex(/[0-9]/, "숫자를 포함해야 합니다.")
      .regex(/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/, "특수문자를 포함해야 합니다."),
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "비밀번호 확인이 일치하지 않습니다.",
    path: ["passwordConfirm"],
  });
```

---

## 6. 에러 처리 / Edge cases

### SSO 흐름

| 시점 | 케이스 | 처리 |
|------|--------|------|
| Microsoft 로그인 페이지 | 사용자 취소 | Microsoft가 `error=...` 첨부 redirect → `/login?error=oauth_failed` |
| Callback에 code 없음 | 비정상 진입 | `/login?error=missing_code` |
| `exchangeCodeForSession` 실패 | code 만료/위조 | `/login?error=exchange_failed` |
| 동일 이메일 user 이미 존재 | Supabase identity 자동 link | 정상 처리 |

### remember 14일 정책

| 케이스 | 처리 |
|--------|------|
| signIn 성공 + 체크 | cookie maxAge=1209600초 → 14일 후 만료 |
| signIn 성공 + 미체크 | cookie maxAge undefined → 브라우저 닫으면 만료 |
| 14일 경과 후 접근 | refresh token도 expired → middleware가 /login redirect |
| 미체크 후 새 탭 | session cookie 유지 → 정상 동작 (탭 vs 창 구분 X) |

### 비밀번호 찾기 흐름

| 케이스 | 처리 |
|--------|------|
| 미가입 이메일 | 동일 info 반환 (enumeration 방지) |
| 잘못된 이메일 형식 | zod 에러 alert |
| Supabase resetPasswordForEmail 자체 에러 | 동일 info 반환 + server log 기록 |
| 메일 링크 만료 (Supabase 기본 1시간) | callback에서 exchange 실패 → `/login?error=exchange_failed` |
| `/reset-password` 직접 진입 (token 없음) | 페이지 마운트 시 `getUser()` 체크 → 없으면 안내 + `/forgot-password` 링크 |
| 새 비밀번호 강도 미달 | zod 에러 alert |
| 비밀번호 ≠ 비밀번호 확인 | zod refine 에러 |
| `updateUser` 실패 (예: same as old) | `{error: error.message}` |
| 이미 로그인된 사용자가 `/reset-password` 진입 | 그대로 허용 (설계 단순) |

### Middleware
PUBLIC_PATHS = `["/login", "/forgot-password", "/reset-password", "/auth/callback"]`로 확장.

### 보안
- forgot-password: enumeration 방지 (가입 여부 노출 X)
- SSO 사용자가 비밀번호 찾기 시도 → 동일 info (Supabase 응답 무관)

---

## 7. 테스트 전략

### Vitest unit (`actions.test.ts` 추가)

| Action | 시나리오 | 케이스 |
|--------|----------|--------|
| `signIn` (remember 갱신) | remember=on/off 시 createClient에 `{rememberMe: true/false}` 전달 검증 | 2 |
| `forgotPassword` | 빈 이메일 / 형식 잘못 / 정상 (Supabase mock으로 호출 검증 + info 반환) | 3 |
| `resetPassword` | 빈 비밀번호 / 8자 미만 / 대문자 누락 / 일치 불일치 / 정상 (updateUser 호출 + redirect) | 5 |

**누적**: 12 (기존) + 10 (신규) = **22 Vitest 케이스**.

### Playwright e2e

| 파일 | 신규 시나리오 |
|------|----------|
| `e2e/login.spec.ts` | SSO 버튼 enabled / "비밀번호 찾기 →" → /forgot-password 라우팅 / remember 체크박스 controlled 동작 |
| `e2e/forgot-password.spec.ts` | 빈 이메일 zod 에러 / 형식 잘못 zod 에러 / 정상 제출 → info alert / "← 로그인으로 돌아가기" 링크 |
| `e2e/reset-password.spec.ts` | token 없이 직접 진입 → 가드 안내 + /forgot-password 링크 / 강도/일치 인디케이터 / 정상 reset → /dashboard (TEST_USER 미설정 시 skip) |

### SSO 자체 e2e 한계
Microsoft 로그인 페이지는 외부라 자동화 불가. **버튼 클릭 → redirect 시작**까지만 e2e (`login.microsoftonline.com` URL prefix 검증). callback 흐름은 Vitest mock으로.

### design-sync
- `/login` SSOButton disabled 제거 외 시각 변경 없음 → 99.3% 유지 기대
- `/forgot-password`, `/reset-password`는 mockup HTML 미존재 → design-sync 대상 외

### 브라우저 시각 검증 (사용자 직접)
- SSO 버튼 클릭 → Microsoft 로그인 페이지 redirect 확인
- remember 체크 후 로그인 → DevTools → Cookies에서 supabase auth cookie의 Expires 확인 (14일 후 vs Session)
- /forgot-password에서 본인 이메일 입력 → 메일함 → 링크 클릭 → /reset-password → 비밀번호 변경 → /dashboard

**누적 e2e**: 52 (현재) + ~13 (신규) = **~65 e2e** 예상.

---

## 8. Risk / Out of scope

### Risk + 완화

| Risk | 영향 | 완화 |
|------|------|------|
| `createClient` 옵션 추가가 기존 호출자와 충돌 | session 끊김 | `rememberMe` 미지정 fallback. dev에서 dashboard/login/middleware 흐름 검증 필수 |
| Supabase ssr cookie maxAge override 미동작 | 체크박스 placebo화 | dev에서 체크/미체크 시 DevTools cookie Expires 직접 확인. 실패 시 fallback: 클라이언트 직접 cookie set (덜 깔끔) |
| Supabase resetPasswordForEmail SMTP 미설정 | 메일 안 가지만 응답 success → 사용자 혼란 | Supabase Dashboard SMTP 설정. info 메시지에 "스팸함 확인" 추가 권장 |
| 동시 reset 시도 (다른 탭) | 의도치 않은 비밀번호 변경 | YAGNI |
| Azure AD redirect URL 미스매치 | callback 실패 | 셋업 시 `https://<supabase>.supabase.co/auth/v1/callback` Azure 등록 확인 |
| dev(localhost:3001) vs prod 도메인 차이 | dev에서 SSO 동작 안 함 | Azure에 dev redirect URL도 등록 |

### Out of scope (다음 spec 후보)
- SSO 사용자에게 비밀번호 추가 발급 (Add password identity)
- "Trust this device" 디바이스 핑거프린팅
- Magic link 로그인
- 다중 SSO provider (Google, GitHub 등)
- 비밀번호 변경 이력 / breach detection
- 2FA / MFA
- /forgot-password에 captcha
- /forgot-password, /reset-password mockup HTML (design-sync 대상)
- "마지막 로그인 시간" / 감사 로그

---

## 9. 다음 단계

1. ✅ design.md 작성 (이 문서)
2. spec self-review (placeholder, 모순, 모호성, scope)
3. 사용자 spec 검토
4. writing-plans 스킬 호출 → `design-ref/2026-04-26-login-extras-plan.md`
5. subagent-driven-development로 task 단위 실행

### 산출물 (구현 완료 시점)
- 신규 페이지 2개 (`/forgot-password`, `/reset-password`) + route handler 1개 (`/auth/callback`)
- 신규 컴포넌트 1개 (`AuthShell`)
- Server Actions 2개 추가 (`forgotPassword`, `resetPassword`) + `signIn` 갱신 + 클라이언트 `signInWithOAuth` 호출
- schemas 2개 추가
- middleware PUBLIC_PATHS 확장
- Vitest 22 케이스 / Playwright ~65 케이스
- 메모리: SSO 패턴, cookie maxAge override 패턴 학습 기록
