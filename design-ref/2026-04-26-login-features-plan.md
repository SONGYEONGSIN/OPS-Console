# Login Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Folio /login에 self-signup 경로(이메일+비밀번호+비밀번호 확인) + 비밀번호 강도/일치 실시간 인디케이터 + titlebar/brand-foot 실시간 시계 추가.

**Architecture:** TDD로 Server Action 도메인부터 진행 — (1) `signUpSchema` zod 강도 정규식 정의 + `AuthState`에 `info` 필드 추가, (2) `signUp` Server Action TDD, (3) Clock 컴포넌트 inline (SSR-safe), (4) 모드 state + TabNav + SignInForm 분리, (5) PasswordStrengthIndicator / PasswordMatchIndicator + SignUpForm 통합, (6) mockup 시각 동기화, (7) e2e 신규 시나리오 + 최종 검증.

**Tech Stack:** Next.js 16 + React 19 + Tailwind v4 + zod + Supabase auth (`signUp`) + Vitest + Playwright.

**Repository note:** Folio는 git 저장소 아님. "commit" 단계는 *"검증 통과 보고"* 로 대체.

**Spec 참조:** `design-ref/2026-04-26-login-features-design.md`

---

## File Structure

이 plan에서 수정/생성/참조되는 파일:

- **Modify**: `src/features/auth/schemas.ts` — `signUpSchema` 추가 (zod regex 비밀번호 강도)
- **Modify**: `src/features/auth/actions.ts` — `signUp` 추가, `AuthState` 타입 확장 (`info?: string`)
- **Modify**: `src/features/auth/actions.test.ts` — signUp 6 테스트 (TDD)
- **Modify**: `src/app/login/page.tsx` — Clock 컴포넌트 + TabNav + 모드 state + SignUpForm + 두 인디케이터 (모두 inline)
- **Modify**: `design-ref/folio-login.html` — mockup 시각 동기화 (탭 + 인디케이터 자리)
- **Modify**: `e2e/login.spec.ts` — 5 신규 시나리오
- **Reference (no edit)**: `lib/supabase/*`, `middleware.ts`, `design-tokens.ts`, `globals.css`

---

## Task 1: Schema + AuthState 타입 확장

`signUpSchema`(zod 비밀번호 강도) 추가 + `AuthState`에 `info?: string` 추가.

**Files:**
- Modify: `src/features/auth/schemas.ts` (signUpSchema export 추가)
- Modify: `src/features/auth/actions.ts` (AuthState 타입 확장)

- [ ] **Step 1: signUpSchema 추가**

`src/features/auth/schemas.ts`에 추가:

```ts
export const signUpSchema = z
  .object({
    email: z
      .string()
      .min(1, "이메일을 입력해주세요.")
      .email("이메일 형식이 올바르지 않습니다."),
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

export type SignUpInput = z.infer<typeof signUpSchema>;
```

- [ ] **Step 2: AuthState 타입 확장**

`src/features/auth/actions.ts`의 export type AuthState 정의 변경:

```ts
// before
export type AuthState = { error: string } | undefined;

// after
export type AuthState = { error?: string; info?: string } | undefined;
```

기존 signIn 코드의 `return { error: error.message }` 등은 그대로 호환 (`error` optional이므로 OK).

- [ ] **Step 3: tsc 회귀**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 4: 체크포인트**

```
Task 1 완료 — Schema + AuthState 타입 확장
- signUpSchema export ✓
- AuthState에 info?: string 추가 ✓
- tsc 회귀 0
```

---

## Task 2: signUp Server Action (TDD)

RED-GREEN: 6 테스트 작성 → fail 확인 → signUp 구현 → pass 확인.

**Files:**
- Modify: `src/features/auth/actions.test.ts` (6 테스트 추가)
- Modify: `src/features/auth/actions.ts` (signUp 추가)

- [ ] **Step 1: 6 테스트 작성 (RED)**

`src/features/auth/actions.test.ts` 끝에 새 describe 블록 추가:

```ts
import { signUp } from "./actions";  // 기존 imports에 추가

describe("signUp", () => {
  beforeEach(() => vi.clearAllMocks());

  it("빈 이메일이면 zod 에러 반환", async () => {
    const fd = new FormData();
    fd.set("email", "");
    fd.set("password", "Aa1!aaaa");
    fd.set("passwordConfirm", "Aa1!aaaa");
    const result = await signUp(undefined, fd);
    expect(result).toEqual({ error: "이메일을 입력해주세요." });
  });

  it("이메일 형식 잘못되면 zod 에러", async () => {
    const fd = new FormData();
    fd.set("email", "not-an-email");
    fd.set("password", "Aa1!aaaa");
    fd.set("passwordConfirm", "Aa1!aaaa");
    const result = await signUp(undefined, fd);
    expect(result).toEqual({ error: "이메일 형식이 올바르지 않습니다." });
  });

  it("비밀번호 8자 미만이면 zod 에러", async () => {
    const fd = new FormData();
    fd.set("email", "a@b.com");
    fd.set("password", "Aa1!aa");
    fd.set("passwordConfirm", "Aa1!aa");
    const result = await signUp(undefined, fd);
    expect(result).toEqual({ error: "비밀번호는 8자 이상이어야 합니다." });
  });

  it("비밀번호 대문자 누락이면 zod 에러", async () => {
    const fd = new FormData();
    fd.set("email", "a@b.com");
    fd.set("password", "aa1!aaaa");
    fd.set("passwordConfirm", "aa1!aaaa");
    const result = await signUp(undefined, fd);
    expect(result).toEqual({ error: "영문 대문자를 포함해야 합니다." });
  });

  it("비밀번호 확인 불일치면 refine 에러", async () => {
    const fd = new FormData();
    fd.set("email", "a@b.com");
    fd.set("password", "Aa1!aaaa");
    fd.set("passwordConfirm", "Bb2@bbbb");
    const result = await signUp(undefined, fd);
    expect(result).toEqual({ error: "비밀번호 확인이 일치하지 않습니다." });
  });

  it("성공 시 Supabase signUp 호출 + info 반환", async () => {
    const signUpSpy = vi.fn().mockResolvedValue({ error: null });
    mockCreate.mockResolvedValue({ auth: { signUp: signUpSpy } });
    const fd = new FormData();
    fd.set("email", "a@b.com");
    fd.set("password", "Aa1!aaaa");
    fd.set("passwordConfirm", "Aa1!aaaa");
    const result = await signUp(undefined, fd);
    expect(signUpSpy).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "Aa1!aaaa",
    });
    expect(result).toEqual({
      info: "확인 메일을 발송했습니다. 메일함을 확인해주세요.",
    });
  });
});
```

- [ ] **Step 2: 테스트 실행 → RED 확인**

```bash
npm test
```

Expected: import "signUp" 실패 — `signUp` actions.ts에 없음. Error: "Failed to resolve import 'signUp'".

- [ ] **Step 3: signUp 구현 (GREEN)**

`src/features/auth/actions.ts` 끝에 추가 (또는 signOut 위에):

```ts
import { signInSchema, signUpSchema } from "./schemas";  // imports 갱신

export async function signUp(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) return { error: error.message };

  return { info: "확인 메일을 발송했습니다. 메일함을 확인해주세요." };
}
```

- [ ] **Step 4: 테스트 재실행 → GREEN 확인**

```bash
npm test
```

Expected: 12 passed (기존 6 signIn/signOut + 신규 6 signUp).

- [ ] **Step 5: tsc 회귀**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 6: 체크포인트**

```
Task 2 완료 — signUp Server Action (TDD)
- RED 확인 → GREEN
- Vitest 12/12 pass
- 변경: src/features/auth/{schemas,actions,actions.test}.ts
```

---

## Task 3: Clock 컴포넌트 (TitleBar + brand-foot 실시간)

LoginPage에 시계 source(useState/useEffect) + 자식 자리에 시각 출력. SSR-safe placeholder.

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: LoginPage에 시계 source state 추가**

`src/app/login/page.tsx`의 `LoginPage` 본문 시작 부분 (기존 useState 옆) 추가:

```tsx
const [now, setNow] = useState<Date | null>(null);
useEffect(() => {
  setNow(new Date());
  const id = setInterval(() => setNow(new Date()), 1000);
  return () => clearInterval(id);
}, []);
```

`useEffect` import 확인 — `import { useActionState, useEffect, useState } from "react";`

- [ ] **Step 2: Clock 컴포넌트 정의**

LoginPage 함수 외부 (다른 컴포넌트들과 같은 위치)에 추가:

```tsx
function Clock({
  now,
  variant,
}: {
  now: Date | null;
  variant: "titlebar" | "brand-foot-date" | "brand-foot-time";
}) {
  if (!now) {
    if (variant === "titlebar") return <>------ · --:-- KST</>;
    if (variant === "brand-foot-date") return <>---- · -- · -- · -</>;
    return <>--:-- KST</>;
  }
  // KST 고정 — Asia/Seoul
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("ko-KR", { ...opts, timeZone: "Asia/Seoul" }).format(
      now
    );
  if (variant === "titlebar") {
    // "2026.10.31 · 09:42 KST"
    const date = fmt({
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).replace(/\. /g, ".").replace(/\.$/, "");
    const time = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });
    return <>{`${date} · ${time} KST`}</>;
  }
  if (variant === "brand-foot-date") {
    // "2026 · 10 · 31 · 금"
    const parts = new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      timeZone: "Asia/Seoul",
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return <>{`${get("year")} · ${get("month")} · ${get("day")} · ${get("weekday")}`}</>;
  }
  // "09:42 KST"
  const time = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });
  return <>{`${time} KST`}</>;
}
```

- [ ] **Step 3: TitleBar에 Clock 끼우기**

기존 TitleBar의 우측 시간 div를 변경. LoginPage가 prop으로 `now`를 TitleBar에 전달해야 함:

LoginPage JSX:
```tsx
<TitleBar now={now} />
```

TitleBar signature:
```tsx
function TitleBar({ now }: { now: Date | null }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] ...">
      ...
      <div className="ref text-xs text-faint tracking-[0.04em] max-[479px]:text-[10px]">
        <Clock now={now} variant="titlebar" />
      </div>
    </div>
  );
}
```

(기존 정적 텍스트 `2026.04.25 · 14:12 KST` 제거)

- [ ] **Step 4: BrandPanel 좌하단에 Clock 끼우기**

BrandPanel signature에 `now: Date | null` prop 추가. brand-foot의 date-stack 내부 변경:

```tsx
<div className="flex flex-col gap-0.5 text-right max-md:text-left">
  <span className="ref date text-md font-medium text-ink">
    <Clock now={now} variant="brand-foot-date" />
  </span>
  <span className="shift">
    <Clock now={now} variant="brand-foot-time" />
  </span>
</div>
```

LoginPage JSX의 BrandPanel:
```tsx
<BrandPanel now={now} />
```

- [ ] **Step 5: tsc + lint 회귀**

```bash
npx tsc --noEmit
npm run lint
```

Expected: 둘 다 exit 0.

- [ ] **Step 6: 시각 확인 (dev)**

dev server에서 `/login` 열기. 우상단/좌하단 시계가 1초 간격으로 분 표시 갱신되는지 (분이 바뀌는 시점 1초 안에 반영). 첫 렌더 시 `------ · --:-- KST` placeholder 잠깐 보이고 즉시 실 시간으로 전환.

- [ ] **Step 7: 체크포인트**

```
Task 3 완료 — Clock 컴포넌트
- 우상단 + 좌하단 둘 다 동적 시계
- SSR placeholder → mount 후 실 시간
- tsc/lint 회귀 0
```

---

## Task 4: 모드 state + TabNav + SignInForm 분리

LoginPage에 mode state 추가, 기존 폼을 SignInForm 컴포넌트로 분리, TabNav로 모드 전환.

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: 모드 state 추가**

LoginPage 본문에 추가 (Task 3의 `now` 옆):
```tsx
const [mode, setMode] = useState<"signin" | "signup">("signin");
```

- [ ] **Step 2: TabNav 컴포넌트 추가**

LoginPage 외부 함수로:
```tsx
function TabNav({
  mode,
  setMode,
}: {
  mode: "signin" | "signup";
  setMode: (m: "signin" | "signup") => void;
}) {
  return (
    <div className="mb-5 flex items-center gap-6 text-sm">
      <button
        type="button"
        onClick={() => setMode("signin")}
        className={`relative pb-1 transition-colors ${
          mode === "signin"
            ? "font-bold text-vermilion after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-vermilion after:content-['']"
            : "text-muted hover:text-ink"
        }`}
      >
        로그인
      </button>
      <button
        type="button"
        onClick={() => setMode("signup")}
        className={`relative pb-1 transition-colors ${
          mode === "signup"
            ? "font-bold text-vermilion after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-vermilion after:content-['']"
            : "text-muted hover:text-ink"
        }`}
      >
        계정 생성
      </button>
    </div>
  );
}
```

- [ ] **Step 3: 기존 form을 SignInForm 컴포넌트로 분리**

기존 `<form action={formAction} ...>` 전체 영역을 잘라내 새 컴포넌트:
```tsx
function SignInForm({
  formAction,
  error,
  showPassword,
  onToggle,
}: {
  formAction: (formData: FormData) => void;
  error: string | undefined;
  showPassword: boolean;
  onToggle: () => void;
}) {
  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {error && (
        <div role="alert" className="border border-vermilion bg-vermilion/10 px-3 py-2 text-xs text-vermilion">
          {error}
        </div>
      )}
      <Field id="email" label="이메일" type="text" autoComplete="username" placeholder="yss@opsroom.local 또는 EMP-0425" />
      <Field
        id="password"
        label="비밀번호"
        type={showPassword ? "text" : "password"}
        autoComplete="current-password"
        placeholder="••••••••"
        trailing={
          <button
            type="button"
            aria-label="비밀번호 표시/숨김"
            aria-pressed={showPassword}
            onClick={onToggle}
            className="absolute right-0 top-1/2 -translate-y-1/2 cursor-pointer p-2 text-xs tracking-[0.06em] text-muted transition-colors hover:text-ink min-h-[var(--tap-min)]"
          >
            {showPassword ? "숨김" : "표시"}
          </button>
        }
      />
      <div className="mt-1 flex items-center justify-between max-md:flex-col max-md:items-start max-md:gap-2">
        <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm text-ink-soft min-h-[var(--tap-min)]">
          <input
            type="checkbox"
            name="remember"
            defaultChecked
            className="relative h-3.5 w-3.5 flex-shrink-0 cursor-pointer appearance-none border border-line bg-transparent checked:bg-ink checked:after:absolute checked:after:left-1/2 checked:after:top-1/2 checked:after:-translate-x-1/2 checked:after:-translate-y-[52%] checked:after:text-[11px] checked:after:leading-none checked:after:text-cream checked:after:content-['✓']"
          />
          <span>이 기기 기억 · 14일</span>
        </label>
        <a
          href="#"
          className="inline-flex items-center text-sm tracking-[0.02em] text-muted no-underline transition-colors hover:text-vermilion min-h-[var(--tap-min)]"
        >
          비밀번호 찾기 →
        </a>
      </div>
      <SubmitButton label="로그인" pendingLabel="로그인 중…" />
    </form>
  );
}
```

`SubmitButton`도 label/pendingLabel prop 추가:
```tsx
function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 border border-ink bg-ink px-5 text-md tracking-[0.04em] text-cream transition-colors duration-150 hover:border-vermilion hover:bg-vermilion active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 min-h-12"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
```

기존 SubmitButton 호출은 모두 prop 형태로 갱신.

- [ ] **Step 4: AuthPanel에서 mode 분기**

기존 AuthPanel signature에 `mode`, `setMode` 추가. divider 다음에 TabNav, 그 다음에 mode 분기:

```tsx
<div className="my-6 flex items-center gap-3 text-xs tracking-[0.08em] text-faint before:h-px before:flex-1 before:bg-line-soft before:content-[''] after:h-px after:flex-1 after:bg-line-soft after:content-['']">
  <span>또는 이메일로 로그인</span>
</div>

<TabNav mode={mode} setMode={setMode} />

{mode === "signin" ? (
  <SignInForm formAction={formAction} error={error} showPassword={showPassword} onToggle={onToggle} />
) : (
  <p className="text-sm text-muted">/* SignUpForm placeholder — Task 5에서 구현 */ 계정 생성 폼 (Task 5)</p>
)}
```

LoginPage JSX:
```tsx
<AuthPanel
  showPassword={showPassword}
  onToggle={() => setShowPassword((s) => !s)}
  formAction={formAction}
  error={state?.error}
  mode={mode}
  setMode={setMode}
/>
```

- [ ] **Step 5: tsc + lint 회귀**

```bash
npx tsc --noEmit
npm run lint
```

Expected: 둘 다 exit 0.

- [ ] **Step 6: 회귀 e2e (signin 모드 그대로 동작 확인)**

```bash
PID=$(cat /tmp/folio-dev-3001.pid 2>/dev/null); kill "$PID" 2>/dev/null; sleep 2
npm run test:e2e
PATH=/usr/local/bin:/usr/bin:/bin:$PATH npx next dev -p 3001 > /tmp/folio-dev-3001.log 2>&1 &
echo $! > /tmp/folio-dev-3001.pid
```

Expected: 40 passed (signin 모드 폼 회귀 0). signup 모드 placeholder는 e2e 안 건드리므로 무관.

- [ ] **Step 7: 체크포인트**

```
Task 4 완료 — 모드 state + TabNav + SignInForm 분리
- TabNav 작동 (signin ↔ signup 토글)
- SignInForm 분리됨, 기존 동작 회귀 0
- e2e 40 passed
```

---

## Task 5: PasswordStrengthIndicator + PasswordMatchIndicator + SignUpForm 통합

비밀번호 4 항목 인디케이터 + 비밀번호 확인 일치 인디케이터 + signUp Server Action 호출하는 SignUpForm.

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: PasswordStrengthIndicator 컴포넌트 추가**

LoginPage 외부에:
```tsx
function PasswordStrengthIndicator({ value }: { value: string }) {
  const checks = [
    { label: "영문 대문자 포함", ok: /[A-Z]/.test(value) },
    { label: "숫자 포함", ok: /[0-9]/.test(value) },
    { label: '특수문자 포함', ok: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/.test(value) },
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
```

- [ ] **Step 2: PasswordMatchIndicator 컴포넌트 추가**

```tsx
function PasswordMatchIndicator({
  pw,
  confirm,
}: {
  pw: string;
  confirm: string;
}) {
  if (!confirm) return null;
  const ok = pw === confirm;
  return (
    <div className={`mt-1 text-xs ${ok ? "text-sage" : "text-vermilion"}`}>
      <span className="mr-1">{ok ? "✓" : "✗"}</span>
      {ok ? "비밀번호와 일치" : "비밀번호와 다름"}
    </div>
  );
}
```

- [ ] **Step 3: SignUpForm 컴포넌트 추가**

```tsx
function SignUpForm({
  formAction,
  error,
  info,
}: {
  formAction: (formData: FormData) => void;
  error: string | undefined;
  info: string | undefined;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showCfm, setShowCfm] = useState(false);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {error && (
        <div role="alert" className="border border-vermilion bg-vermilion/10 px-3 py-2 text-xs text-vermilion">
          {error}
        </div>
      )}
      {info && (
        <div role="status" className="border border-sage bg-sage/10 px-3 py-2 text-xs text-sage">
          {info}
        </div>
      )}
      <Field id="email" label="이메일" type="email" autoComplete="email" placeholder="yss@opsroom.local" />
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
            <button
              type="button"
              aria-label="비밀번호 표시/숨김"
              aria-pressed={showPw}
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-0 top-1/2 -translate-y-1/2 cursor-pointer p-2 text-xs tracking-[0.06em] text-muted transition-colors hover:text-ink min-h-[var(--tap-min)]"
            >
              {showPw ? "숨김" : "표시"}
            </button>
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
            <button
              type="button"
              aria-label="비밀번호 확인 표시/숨김"
              aria-pressed={showCfm}
              onClick={() => setShowCfm((s) => !s)}
              className="absolute right-0 top-1/2 -translate-y-1/2 cursor-pointer p-2 text-xs tracking-[0.06em] text-muted transition-colors hover:text-ink min-h-[var(--tap-min)]"
            >
              {showCfm ? "숨김" : "표시"}
            </button>
          }
        />
        <PasswordMatchIndicator pw={password} confirm={confirm} />
      </div>
      <SubmitButton label="계정 생성" pendingLabel="계정 생성 중…" />
    </form>
  );
}
```

`Field` 컴포넌트는 controlled/uncontrolled 둘 다 지원해야 함. 기존 `Omit<InputHTMLAttributes, "className">` 타입에 `value`/`onChange`가 이미 포함됨 — 별도 변경 불필요.

- [ ] **Step 4: LoginPage에 useActionState 두 개 (signin + signup)**

```tsx
const [signInState, signInAction] = useActionState<AuthState, FormData>(signIn, undefined);
const [signUpState, signUpAction] = useActionState<AuthState, FormData>(signUp, undefined);
```

`signUp` import 추가 in `src/app/login/page.tsx`:
```tsx
import { signIn, signUp, type AuthState } from "@/features/auth/actions";
```

- [ ] **Step 5: AuthPanel에 두 form 분기**

기존 AuthPanel signature 갱신:
```tsx
function AuthPanel({
  mode,
  setMode,
  signInAction,
  signUpAction,
  signInError,
  signUpError,
  signUpInfo,
  showPassword,
  onToggle,
}: {
  mode: "signin" | "signup";
  setMode: (m: "signin" | "signup") => void;
  signInAction: (formData: FormData) => void;
  signUpAction: (formData: FormData) => void;
  signInError: string | undefined;
  signUpError: string | undefined;
  signUpInfo: string | undefined;
  showPassword: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="...">
      <div className="w-full max-w-[420px]">
        ...
        <div className="my-6 flex items-center ...">
          <span>또는 이메일로 로그인</span>
        </div>
        <TabNav mode={mode} setMode={setMode} />
        {mode === "signin" ? (
          <SignInForm formAction={signInAction} error={signInError} showPassword={showPassword} onToggle={onToggle} />
        ) : (
          <SignUpForm formAction={signUpAction} error={signUpError} info={signUpInfo} />
        )}
        ...
      </div>
    </section>
  );
}
```

LoginPage JSX 갱신:
```tsx
<AuthPanel
  mode={mode}
  setMode={setMode}
  signInAction={signInAction}
  signUpAction={signUpAction}
  signInError={signInState?.error}
  signUpError={signUpState?.error}
  signUpInfo={signUpState?.info}
  showPassword={showPassword}
  onToggle={() => setShowPassword((s) => !s)}
/>
```

- [ ] **Step 6: tsc + lint 회귀**

```bash
npx tsc --noEmit
npm run lint
```

Expected: 둘 다 exit 0.

- [ ] **Step 7: 시각 확인 (dev)**

브라우저 `/login` → "계정 생성" 탭 클릭. 폼이 이메일 + 비밀번호 + 비밀번호 확인 + 인디케이터로 변경. 비밀번호 입력하면서 4 항목이 ✓/✗ 즉각 변동, 비밀번호 확인 다른 값 입력 시 vermilion `✗ 비밀번호와 다름`.

- [ ] **Step 8: 체크포인트**

```
Task 5 완료 — 인디케이터 + SignUpForm
- PasswordStrengthIndicator: 4 항목 실시간 ✓/✗
- PasswordMatchIndicator: 일치/불일치 표시
- SignUpForm: signUp Server Action 연결
- 모드 전환 시 두 폼 독립 (input state 별도)
```

---

## Task 6: mockup HTML 시각 동기화

mockup `folio-login.html`에도 탭 + 인디케이터 자리 + 시계 시각 추가 (정적 HTML로). 동작은 React에 위임.

**Files:**
- Modify: `design-ref/folio-login.html`

- [ ] **Step 1: divider 다음에 탭 + 폼 변형 시각 추가**

기존 mockup의 `<div class="divider">` 다음 `<form class="auth-form">`으로 가는데, 그 사이에 탭을 표시하고 폼은 mockup상 default 모드(signin) 그대로. 추가 안내가 필요하면 정적으로:

mockup `<div class="divider">또는 이메일로 로그인</div>` 다음에 추가 (line 776 근처):
```html
<!-- 모드 탭 (시각만, 동작은 React) -->
<div class="auth-tabs">
  <span class="active">로그인</span>
  <span>계정 생성</span>
</div>
```

CSS도 `<style>` 끝쯤에 추가:
```css
.auth-tabs {
  display: flex;
  gap: var(--space-6);
  margin-bottom: var(--space-5);
  font-size: var(--text-sm);
}
.auth-tabs span {
  padding-bottom: 4px;
  position: relative;
  color: var(--muted);
  cursor: pointer;
}
.auth-tabs span.active {
  color: var(--vermilion);
  font-weight: 700;
}
.auth-tabs span.active::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--vermilion);
}
```

- [ ] **Step 2: titlebar 시각 syntax 변경 (시계 placeholder 의도 표시)**

mockup `<div class="titlebar-right">2026.04.25 · 14:12 KST</div>` → 그대로 둠 (mockup이 정적 spec — 실제 시간은 React가 갱신). 변경 없음.

- [ ] **Step 3: brand-foot date 시각 syntax 변경**

mockup `<span class="shift">14:30 KST</span>` → 그대로 둠 (정적).

- [ ] **Step 4: design-sync 재측정**

```bash
LOCAL_BASE=http://localhost:3001 npm run design-sync
```

Expected: login desktop sync 변동 (탭 추가로 격차 발생 가능). 잔여 격차 < 5%p 허용 (디자인 동기화는 "탭 자리"만 표시 — 실제 React는 탭 + 인디케이터 모두 렌더).

- [ ] **Step 5: 체크포인트**

```
Task 6 완료 — mockup HTML 시각 동기화
- 탭 영역 mockup에 추가
- design-sync 재측정 결과: __%
```

---

## Task 7: e2e 신규 시나리오 + 최종 검증

**Files:**
- Modify: `e2e/login.spec.ts`

- [ ] **Step 1: 5 신규 e2e 시나리오 추가**

`e2e/login.spec.ts` 끝에 추가:

```ts
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
  await expect(page.getByText("영문 대문자 포함")).toHaveClass(/text-sage/);
  await expect(page.getByText("숫자 포함")).toHaveClass(/text-sage/);
  await expect(page.getByText("특수문자 포함")).toHaveClass(/text-sage/);
  await expect(page.getByText("8자 이상")).toHaveClass(/text-sage/);
});

test("비밀번호 강도 인디케이터: 미충족 시 muted/✗", async ({ page }) => {
  await page.getByRole("button", { name: "계정 생성", exact: true }).click();
  await page.locator('input[name="password"]').fill("aa");
  await expect(page.getByText("영문 대문자 포함")).toHaveClass(/text-muted/);
  await expect(page.getByText("8자 이상")).toHaveClass(/text-muted/);
});

test("비밀번호 일치 인디케이터", async ({ page }) => {
  await page.getByRole("button", { name: "계정 생성", exact: true }).click();
  await page.locator('input[name="password"]').fill("Aa1!aaaa");
  await page.locator('input[name="passwordConfirm"]').fill("Aa1!aaaa");
  await expect(page.getByText("비밀번호와 일치")).toBeVisible();
  await page.locator('input[name="passwordConfirm"]').fill("Bb2@bbbb");
  await expect(page.getByText("비밀번호와 다름")).toBeVisible();
});

test("실시간 시계: titlebar 분 표시가 placeholder 후 실 시간으로 채워짐", async ({
  page,
}) => {
  await page.goto("/login");
  // 클라이언트 hydration 대기 — placeholder가 잠깐 보이고 즉시 실 시간 채워짐
  await expect(page.locator(".ref.text-xs.text-faint, .ref")).toBeVisible();
  // 실 시간 형식 (`YYYY.MM.DD · HH:MM KST`) 매칭
  const titlebarRight = page.locator("text=/\\d{4}\\.\\d{2}\\.\\d{2} · \\d{2}:\\d{2} KST/");
  await expect(titlebarRight).toBeVisible({ timeout: 5000 });
});
```

- [ ] **Step 2: e2e 실행**

```bash
PID=$(cat /tmp/folio-dev-3001.pid 2>/dev/null); kill "$PID" 2>/dev/null; sleep 2
npm run test:e2e
```

Expected: 45 passed (40 기존 + 5 신규) / 16 skipped (또는 비슷) / 0 failed.

- [ ] **Step 3: dev server 재기동**

```bash
PATH=/usr/local/bin:/usr/bin:/bin:$PATH npx next dev -p 3001 > /tmp/folio-dev-3001.log 2>&1 &
echo $! > /tmp/folio-dev-3001.pid
```

- [ ] **Step 4: 종합 검증**

```bash
npx tsc --noEmit
npm run lint
rm -rf .next && npx next build
npm test
LOCAL_BASE=http://localhost:3001 node scripts/diagnose-layout.mjs | tail -20
LOCAL_BASE=http://localhost:3001 npm run design-sync | tail -10
```

Expected:
- tsc / lint / build 모두 exit 0
- Vitest 12/12
- diagnose-layout: 14 element 모두 Δ < 5px (시계 동작 추가로 약간의 변동 가능, 5px 이내)
- design-sync: login desktop ≥ 96% (현재 99.3%에서 탭/인디케이터 추가로 약간 감소 가능)

- [ ] **Step 5: 메모리 업데이트**

`/Users/yss/.claude/projects/-Users-yss----build-Folio/memory/feedback_signup_password_pattern.md` 작성:

```markdown
---
name: SignUp + 비밀번호 강도/일치 + Clock 패턴
description: zod 비밀번호 강도 정규식 + 실시간 인디케이터 + SSR-safe 시계 + useActionState 두 개 패턴
type: feedback
---

Folio /login features plan(2026-04-26)에서 signUp + 강도 인디케이터 + Clock 추가 시 발견한 재사용 가능 패턴.

## zod 비밀번호 강도

```ts
z.string()
  .min(8, "...")
  .regex(/[A-Z]/, "영문 대문자를 포함해야 합니다.")
  .regex(/[0-9]/, "숫자를 포함해야 합니다.")
  .regex(/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/, "특수문자를 포함해야 합니다.")
```

## 실시간 인디케이터

useState로 input value 캡처 → 같은 정규식을 클라이언트에서 평가 → ✓/✗ 즉각 표시. zod schema와 단일 source of truth는 아니지만 사용자 즉각 피드백 우선.

dashboard plan에서 input validation 시 동일 패턴 — 정적 zod 검증 + 실시간 클라이언트 인디케이터.

## Clock 컴포넌트 (SSR-safe)

```tsx
const [now, setNow] = useState<Date | null>(null);
useEffect(() => {
  setNow(new Date());
  const id = setInterval(() => setNow(new Date()), 1000);
  return () => clearInterval(id);
}, []);
```

`now: Date | null`로 SSR 시 placeholder, mount 후 실 시간. cleanup 필수.

dashboard의 statusbar / appbar 같은 곳에 시간 표시할 때 재사용.

## useActionState 두 개

같은 페이지에 두 Server Action(signIn / signUp)이 있을 때:
```tsx
const [signInState, signInAction] = useActionState<AuthState, FormData>(signIn, undefined);
const [signUpState, signUpAction] = useActionState<AuthState, FormData>(signUp, undefined);
```

각 form은 자기 action만 호출. mode 전환 시 state는 자동 분리.

**Why:** 2026-04-26 Folio /login features plan 실행에서 발견. dashboard에서 다중 Server Action 페이지(예: incident report + comment) 만들 때 재사용.
```

`MEMORY.md`에 인덱스 추가:
```markdown
- [SignUp + 비밀번호 강도/일치 + Clock 패턴](feedback_signup_password_pattern.md) — zod regex + 실시간 인디케이터 + SSR-safe 시계 + 다중 useActionState
```

- [ ] **Step 6: 최종 체크포인트 + 보고**

```
Login features plan 완료.

산출물:
- design.md / plan.md saved to design-ref/
- 코드 변경: src/features/auth/{schemas,actions,actions.test}.ts, src/app/login/page.tsx, design-ref/folio-login.html, e2e/login.spec.ts
- 메모리: feedback_signup_password_pattern.md

검증 결과:
- tsc/lint/build exit 0
- Vitest 12/12
- Playwright 45 passed / 0 failed
- diagnose-layout Δ < 5px
- design-sync login desktop ≥ 96%

브라우저 시각 검증 부탁드립니다:
- /login → 우상단 시계 1초 단위 갱신
- "계정 생성" 탭 → 비밀번호 인디케이터 4항목 ✓/✗ 즉각 변동
- 비밀번호 확인 다른 값 → vermilion "✗ 비밀번호와 다름"
- 유효 입력 + 제출 → "확인 메일을 발송했습니다." sage info alert (TEST_USER 미설정 시 Supabase 호출됨)

다음: Dashboard reconstruction brainstorm (별도 세션 권장 — 이 세션 컨텍스트 큼).
```
