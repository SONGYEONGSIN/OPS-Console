"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, signUp, type AuthState } from "@/features/auth/actions";
import { ALLOWED_EMAILS } from "@/features/auth/operators";

/**
 * 로그인 (입실) — design-ref/folio-login.html 포팅 + Supabase 인증 연결.
 *
 * 폼: useActionState + features/auth/actions.ts의 signIn Server Action.
 * 검증: zod (features/auth/schemas.ts) — 에러 한 줄을 폼 위에 표시.
 * Microsoft SSO: 현재 미구현 — 버튼은 disabled + "준비 중" 라벨.
 */
export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  // 모드 전환 시 이메일 유지 (design-ref §결정 line 31). 비밀번호+확인은 form 자체에서 unmount로 reset.
  const [email, setEmail] = useState("");
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
  useEffect(() => {
    const updateNow = () => setNow(new Date());
    updateNow();
    const id = setInterval(updateNow, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative z-10 grid h-screen grid-rows-[34px_1fr_26px]">
      <TitleBar now={now} />
      <main className="grid h-full min-h-0 grid-cols-1 grid-rows-1 overflow-y-auto lg:grid-cols-2">
        <BrandPanel now={now} />
        <AuthPanel
          mode={mode}
          setMode={setMode}
          email={email}
          setEmail={setEmail}
          showPassword={showPassword}
          onToggle={() => setShowPassword((s) => !s)}
          oauthError={errorMessage}
        />
      </main>
      <StatusBar />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Clock — 현재 시간 포매팅 (TitleBar + BrandPanel 실시간)
   ════════════════════════════════════════════════════════════ */
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
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("ko-KR", { ...opts, timeZone: "Asia/Seoul" }).format(
      now
    );
  if (variant === "titlebar") {
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
  if (variant === "brand-foot-date") {
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
  const time = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });
  return <>{`${time} KST`}</>;
}

/* ════════════════════════════════════════════════════════════
   Title bar — macOS 윈도우 크롬 모티브 (입실 컨텍스트 인디케이터)
   ════════════════════════════════════════════════════════════ */
function TitleBar({ now }: { now: Date | null }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center border-b border-line bg-ink px-3.5 text-cream">
      {/* mockup `.window-ctrls`: ≤479px(컴팩트 모바일)에서만 숨김 */}
      <div className="mr-[18px] flex gap-[7px] max-[479px]:hidden">
        <span className="h-3 w-3 rounded-full border border-cream/20 bg-vermilion" />
        <span className="h-3 w-3 rounded-full border border-cream/20 bg-gold" />
        <span className="h-3 w-3 rounded-full border border-cream/20 bg-sage" />
      </div>
      <div className="text-center text-md font-medium tracking-[0.02em]">
        운영부 <em className="not-italic text-vermilion mx-[3px]">·</em> 로그인
        {/* mockup `.titlebar-text .label-en`: ≤767px(모바일)에서 숨김 */}
        <span className="ml-1.5 text-sm text-faint max-md:hidden">OPSROOM</span>
      </div>
      <div className="ref text-xs text-faint tracking-[0.04em] max-[479px]:text-[10px]">
        <Clock now={now} variant="titlebar" />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Brand panel — 낙관(seal) + 입실 카피 + 시프트 정보
   ════════════════════════════════════════════════════════════ */
function BrandPanel({ now }: { now: Date | null }) {
  return (
    <aside
      className="
        relative flex flex-col justify-between overflow-hidden border-line bg-washi
        py-5 px-4
        md:py-6 md:px-5
        lg:py-8 lg:px-7 lg:border-r lg:border-b-0
        max-lg:border-b
      "
    >
      {/* 배경 큰 글자 워터마크 — 사용자 요청으로 제거 (2026-04-26) */}

      <div className="flex items-center gap-4 max-md:gap-3">
        <Seal />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm uppercase tracking-[0.08em] text-muted max-[479px]:text-[10px]">
            OPSROOM <em className="not-italic text-vermilion mx-1">·</em> v4.2.1
          </span>
          <span className="text-md text-ink-soft">
            <span className="kr">운영부 상황실</span>
          </span>
        </div>
      </div>

      <div className="relative z-10 max-w-[440px] max-lg:max-w-none max-md:mt-4">
        <h1 className="mb-5 text-3xl font-semibold tracking-[-0.03em] leading-[1.15] text-ink">
          로그인 <em className="not-italic text-vermilion font-normal mx-[0.08em]">—</em>{" "}
          운영부
          <span className="mt-2 block text-lg font-light tracking-[0.04em] text-muted">
            OBSERVE · RESPOND · RESOLVE
          </span>
        </h1>
        <p className="max-w-[400px] text-md leading-[1.7] text-ink-soft max-lg:max-w-[560px]">
          12개 서비스, 17개 인프라, 8명의 온콜이 한 화면에서 움직입니다. 사번
          또는 운영실 이메일로 입실하면 지정된 시프트 컨텍스트로 바로
          연결됩니다.
        </p>
      </div>

      <div className="relative z-10 flex items-end justify-between gap-5 text-xs text-muted max-md:mt-5 max-md:flex-col max-md:items-start max-md:gap-3">
        <div className="text-xl font-light tracking-[0.22em] text-vermilion opacity-85 max-md:text-lg">
          기록 · 응대 · 해결
        </div>
        <div className="flex flex-col gap-0.5 text-right max-md:text-left">
          <span className="ref date text-md font-medium text-ink">
            <Clock now={now} variant="brand-foot-date" />
          </span>
          <span className="shift">
            <Clock now={now} variant="brand-foot-time" />
          </span>
        </div>
      </div>
    </aside>
  );
}

/* 낙관(印章) — vermilion 원형 배지 + 외곽 링 */
function Seal() {
  return (
    <div
      className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-vermilion text-2xl font-bold tracking-[0.02em] text-cream max-md:h-12 max-md:w-12 max-md:text-lg"
      style={{
        // ring inset(낙관 윤곽) + 외부 그림자: Tailwind 단일 유틸로 표현 곤란
        boxShadow:
          "0 0 0 1px var(--vermilion-deep) inset, 0 2px 4px rgba(21, 18, 12, 0.1)",
      }}
    >
      <span className="-translate-y-px">운</span>
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-[5px] rounded-full border border-vermilion opacity-35"
      />
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
}: {
  email: string;
  setEmail: (v: string) => void;
  showPassword: boolean;
  onToggle: () => void;
  oauthError: string | undefined;
}) {
  // useActionState를 form 내부로: mode 토글 시 컴포넌트 unmount → state 자동 reset (stale error 방지).
  const [state, formAction] = useActionState<AuthState, FormData>(signIn, undefined);
  const [remember, setRemember] = useState(true);
  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
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
      <Field
        id="email"
        label="이메일"
        type="text"
        autoComplete="username"
        placeholder="jinhakID@jinhakapply.com"
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
   EmailValidationIndicator — 이메일 형식 + 운영부 화이트리스트 실시간 표시
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
    <div className={`mt-2 text-sm font-medium ${isAllowed ? "text-sage" : "text-vermilion"}`}>
      <span className="mr-1.5">{isAllowed ? "✓" : "✗"}</span>
      {isAllowed ? "등록된 운영부 이메일" : "허용된 이메일이 아닙니다."}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PasswordStrengthIndicator — 비밀번호 강도 항목 체크리스트
   ════════════════════════════════════════════════════════════ */
function PasswordStrengthIndicator({ value }: { value: string }) {
  const checks = [
    { label: "영문 대문자 포함", ok: /[A-Z]/.test(value) },
    { label: "숫자 포함", ok: /[0-9]/.test(value) },
    { label: "특수문자 포함", ok: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/.test(value) },
    { label: "8자 이상", ok: value.length >= 8 },
  ];
  return (
    <ul className="mt-2 flex flex-col gap-1 text-sm font-medium">
      {checks.map((c) => (
        <li key={c.label} className={c.ok ? "text-sage" : "text-muted"}>
          <span className="mr-1.5">{c.ok ? "✓" : "✗"}</span>
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
    <div className={`mt-2 text-sm font-medium ${ok ? "text-sage" : "text-vermilion"}`}>
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
        <div role="alert" className="border border-vermilion bg-vermilion/10 px-3 py-2 text-xs text-vermilion">
          {state.error}
        </div>
      )}
      {state?.info && (
        <div role="status" className="border border-sage bg-sage/10 px-3 py-2 text-xs text-sage">
          {state.info}
        </div>
      )}
      <div>
        <Field
          id="email"
          label="이메일"
          type="email"
          autoComplete="email"
          placeholder="jinhakID@jinhakapply.com"
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
}: {
  mode: "signin" | "signup";
  setMode: (m: "signin" | "signup") => void;
  email: string;
  setEmail: (v: string) => void;
  showPassword: boolean;
  onToggle: () => void;
  oauthError: string | undefined;
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
          <SignInForm email={email} setEmail={setEmail} showPassword={showPassword} onToggle={onToggle} oauthError={oauthError} />
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
        // email scope 명시 — Azure AD가 user email을 ID token에 포함하도록.
        // openid + profile + email = OIDC 표준 user info 스코프.
        scopes: "openid profile email",
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

/* ════════════════════════════════════════════════════════════
   Status bar — 연결 상태 / TLS / 빌드
   ════════════════════════════════════════════════════════════ */
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
