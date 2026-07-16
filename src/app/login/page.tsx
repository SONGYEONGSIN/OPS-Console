"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, signUp, type AuthState } from "@/features/auth/actions";
import { ALLOWED_EMAILS } from "@/features/auth/operators";

/**
 * 로그인 (입실) — design-ref/folio-login.html 포팅 + Supabase 인증 연결.
 *
 * 폼: useActionState + features/auth/actions.ts의 signIn Server Action.
 * 검증: zod (features/auth/schemas.ts) — 에러 한 줄을 폼 위에 표시.
 * Microsoft SSO: 현재 미구현 — 버튼은 disabled + "준비 중" 라벨.
 *
 * useSearchParams는 Next.js 16에서 Suspense boundary 안에서만 prerender 가능.
 * page export는 Suspense 래퍼 — 실제 UI는 LoginPageContent가 담당.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  // 모드 전환 시 이메일 유지 (design-ref §결정 line 31). 비밀번호+확인은 form 자체에서 unmount로 reset.
  const [email, setEmail] = useState("");
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const infoParam = searchParams.get("info");
  const errorMessage =
    errorParam === "oauth_failed"
      ? "Microsoft 인증에 실패했습니다."
      : errorParam === "missing_code"
        ? "인증 응답에 오류가 있습니다."
        : errorParam === "exchange_failed"
          ? "세션 발급에 실패했습니다."
          : undefined;
  const infoMessage =
    infoParam === "password_changed"
      ? "비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요."
      : undefined;

  return (
    <div className="relative z-10 grid h-screen grid-rows-[1fr]">
      <main className="flex h-full min-h-0 items-center justify-center overflow-y-auto bg-chrome-snow">
        <AuthPanel
          mode={mode}
          setMode={setMode}
          email={email}
          setEmail={setEmail}
          showPassword={showPassword}
          onToggle={() => setShowPassword((s) => !s)}
          oauthError={errorMessage}
          infoMessage={infoMessage}
        />
      </main>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   TabNav — 로그인 / 계정 생성 탭 전환
   ════════════════════════════════════════════════════════════ */
function TabNav({
  mode,
  setMode,
}: {
  mode: "signin" | "signup";
  setMode: (m: "signin" | "signup") => void;
}) {
  return (
    <div className="mb-5 flex text-sm">
      <button
        type="button"
        onClick={() => setMode("signin")}
        aria-current={mode === "signin" ? "page" : undefined}
        className={`relative flex-1 pb-1 text-center transition-colors ${
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
        aria-current={mode === "signup" ? "page" : undefined}
        className={`relative flex-1 pb-1 text-center transition-colors ${
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

/* ════════════════════════════════════════════════════════════
   SignInForm — 이메일/비밀번호 로그인 폼
   ════════════════════════════════════════════════════════════ */
function SignInForm({
  email,
  setEmail,
  showPassword,
  onToggle,
  oauthError,
  infoMessage,
}: {
  email: string;
  setEmail: (v: string) => void;
  showPassword: boolean;
  onToggle: () => void;
  oauthError: string | undefined;
  infoMessage: string | undefined;
}) {
  // useActionState를 form 내부로: mode 토글 시 컴포넌트 unmount → state 자동 reset (stale error 방지).
  const [state, formAction] = useActionState<AuthState, FormData>(signIn, undefined);
  const [remember, setRemember] = useState(true);
  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {infoMessage && (
        <p role="status" className="text-xs text-sage">
          {infoMessage}
        </p>
      )}
      {oauthError && (
        <p role="alert" className="text-xs text-vermilion">
          {oauthError}
        </p>
      )}
      {state?.error && (
        <p role="alert" className="text-xs text-vermilion">
          {state.error}
        </p>
      )}
      <Field
        id="email"
        label="이메일"
        type="text"
        autoComplete="username"
        placeholder="name@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
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
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="relative h-3.5 w-3.5 flex-shrink-0 cursor-pointer appearance-none border border-line bg-transparent checked:bg-ink checked:after:absolute checked:after:left-1/2 checked:after:top-1/2 checked:after:-translate-x-1/2 checked:after:-translate-y-[52%] checked:after:text-[11px] checked:after:leading-none checked:after:text-cream checked:after:content-['✓']"
          />
          <span>이 기기 기억 · 14일</span>
        </label>
        <Link
          href="/forgot-password"
          className="inline-flex items-center text-sm tracking-[0.02em] text-muted no-underline transition-colors hover:text-vermilion min-h-[var(--tap-min)]"
        >
          비밀번호 찾기 →
        </Link>
      </div>
      <SubmitButton label="로그인" pendingLabel="로그인 중…" />
    </form>
  );
}

/* ════════════════════════════════════════════════════════════
   EmailValidationIndicator — 이메일 형식 + 가입 가능 여부 실시간 표시.
   메시지는 화이트리스트 정책을 직접 노출하지 않도록 일반화 (도메인 enumeration 방지).
   ════════════════════════════════════════════════════════════ */
function EmailValidationIndicator({ value }: { value: string }) {
  if (!value) return null;
  // 클라이언트 측 형식 검증 — server zod와 동일 정책 (단일 source of truth는 schemas.ts)
  const isValidFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (!isValidFormat) {
    return (
      <div className="mt-2 text-sm font-medium text-vermilion">
        <span className="mr-1.5">✗</span>
        이메일 형식이 올바르지 않습니다.
      </div>
    );
  }
  const isAllowed = ALLOWED_EMAILS.has(value);
  return (
    <div className={`mt-2 text-sm ${isAllowed ? "font-bold text-sage" : "font-medium text-vermilion"}`}>
      <span className="mr-1.5">{isAllowed ? "✓" : "✗"}</span>
      {isAllowed ? "가입 가능한 이메일" : "가입 불가능한 이메일입니다."}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PasswordStrengthIndicator — 비밀번호 강도 항목 체크리스트
   ════════════════════════════════════════════════════════════ */
function PasswordStrengthIndicator({ value }: { value: string }) {
  const checks = [
    { label: "대문자", ok: /[A-Z]/.test(value) },
    { label: "숫자", ok: /[0-9]/.test(value) },
    { label: "특수문자", ok: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/.test(value) },
    { label: "8자+", ok: value.length >= 8 },
  ];
  return (
    <ul className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {checks.map((c) => (
        <li
          key={c.label}
          className={c.ok ? "font-bold text-sage" : "text-muted"}
        >
          <span className="mr-1">{c.ok ? "✓" : "✗"}</span>
          {c.label}
        </li>
      ))}
    </ul>
  );
}

/* ════════════════════════════════════════════════════════════
   PasswordMatchIndicator — 비밀번호 일치 여부 표시
   ════════════════════════════════════════════════════════════ */
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
    <div className={`mt-2 text-sm ${ok ? "font-bold text-sage" : "font-medium text-vermilion"}`}>
      <span className="mr-1.5">{ok ? "✓" : "✗"}</span>
      {ok ? "비밀번호와 일치" : "비밀번호와 다름"}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SignUpForm — 이메일/비밀번호 계정 생성 폼
   ════════════════════════════════════════════════════════════ */
function SignUpForm({
  email,
  setEmail,
}: {
  email: string;
  setEmail: (v: string) => void;
}) {
  const [state, formAction] = useActionState<AuthState, FormData>(signUp, undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showCfm, setShowCfm] = useState(false);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {state?.error && (
        <p role="alert" className="text-xs text-vermilion">
          {state.error}
        </p>
      )}
      {state?.info && (
        <p role="status" className="text-xs text-sage">
          {state.info}
        </p>
      )}
      <div>
        <Field
          id="email"
          label="이메일"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <EmailValidationIndicator value={email} />
      </div>
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

/* ════════════════════════════════════════════════════════════
   Auth panel — crumb / 타이틀 / SSO / 탭 / 폼 / 푸터
   ════════════════════════════════════════════════════════════ */
function AuthPanel({
  mode,
  setMode,
  email,
  setEmail,
  showPassword,
  onToggle,
  oauthError,
  infoMessage,
}: {
  mode: "signin" | "signup";
  setMode: (m: "signin" | "signup") => void;
  email: string;
  setEmail: (v: string) => void;
  showPassword: boolean;
  onToggle: () => void;
  oauthError: string | undefined;
  infoMessage: string | undefined;
}) {
  return (
    <section
      className="
        flex flex-col items-center justify-center
        py-5 px-4
        md:py-6 md:px-5
        lg:py-8 lg:px-7
      "
    >
      <div className="w-full max-w-[420px]">
        <nav className="mb-5 flex items-center gap-2 text-xs tracking-[0.04em] text-muted">
          <span>운영부</span>
          <span className="text-faint">/</span>
          <span>인증</span>
          <span className="text-faint">/</span>
          <strong className="font-semibold text-ink">로그인</strong>
        </nav>

        <h2 className="mb-2 text-2xl font-semibold tracking-[-0.02em]">
          계정 인증
        </h2>
        <p className="mb-6 text-sm leading-[1.6] text-muted">
          회사 계정(Microsoft)으로 로그인 하거나, 직접 계정 생성하여 로그인 하세요.
        </p>

        <SSOButton />

        <div className="my-6 flex items-center gap-3 text-xs tracking-[0.08em] text-faint before:h-px before:flex-1 before:bg-line-soft before:content-[''] after:h-px after:flex-1 after:bg-line-soft after:content-['']">
          <span>또는 이메일로 로그인</span>
        </div>

        <TabNav mode={mode} setMode={setMode} />

        {mode === "signin" ? (
          <SignInForm email={email} setEmail={setEmail} showPassword={showPassword} onToggle={onToggle} oauthError={oauthError} infoMessage={infoMessage} />
        ) : (
          <SignUpForm email={email} setEmail={setEmail} />
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5 border-t border-line-soft pt-4 text-sm text-muted">
          {mode === "signin" ? (
            <>
              <span>운영부 상황실 계정이 없으신가요?</span>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="cursor-pointer border-none bg-transparent p-0 font-medium text-vermilion transition-colors hover:underline"
              >
                계정 생성 바로가기
              </button>
            </>
          ) : (
            <>
              <span>이미 계정이 있으신가요?</span>
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="cursor-pointer border-none bg-transparent p-0 font-medium text-vermilion transition-colors hover:underline"
              >
                로그인 바로가기
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * 입실/제출 버튼 — useFormStatus로 pending 상태 표시.
 * Server Action 호출 시 자동으로 disabled + 라벨 변경.
 */
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

/* ════════════════════════════════════════════════════════════
   Field — 라벨 + 밑줄 입력 + 에러 슬롯
   ════════════════════════════════════════════════════════════ */
type FieldProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "className"
> & {
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
          // line-height: normal 강제 — mockup input은 line-height 미명시(브라우저 default ≈ 1.15),
          // 우리는 Tailwind preflight `font: inherit`으로 body의 1.5 inherit → input height 44px.
          // [line-height:normal]로 mockup과 동일한 ~39px 매칭.
          className="w-full border-none bg-transparent py-3 text-md tracking-[-0.005em] text-ink outline-none placeholder:text-faint [line-height:normal]"
        />
        {trailing}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SSO — Microsoft 4색 윈도우 마크 + 우선 경로 스타일
   ════════════════════════════════════════════════════════════ */
function SSOButton() {
  const handleSSO = async () => {
    const { createBrowserClient } = await import("@supabase/ssr");
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // openid + profile + email = OIDC 표준 user info. offline_access = refresh token.
        // Files/Sites.ReadWrite.All = 경위서 .docx를 운영자 자격으로 SharePoint 업로드
        // (만든 사람=운영자) — 위임 토큰 발급용. Azure가 단축명을 거부하면
        // https://graph.microsoft.com/Files.ReadWrite.All 형태 전체 URI로 교체.
        scopes:
          "openid profile email offline_access Files.ReadWrite.All Sites.ReadWrite.All",
        // prompt=login — 브라우저에 MS 세션이 남아 있어도 항상 재인증 강제.
        // 로그아웃·자동 세션 만료 후 버튼 클릭만으로 자동 재로그인되는 것 차단(공용 PC 보안).
        queryParams: { prompt: "login" },
      },
    });
  };

  return (
    <button
      type="button"
      onClick={handleSSO}
      aria-label="Microsoft SSO로 계속"
      className="inline-flex w-full cursor-pointer items-center justify-center gap-3 border border-ink bg-transparent px-5 text-md tracking-[0.02em] text-ink transition-colors duration-150 min-h-12 [box-shadow:0_1px_0_rgba(21,18,12,0.04)] hover:bg-ink hover:text-cream active:translate-y-px"
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

