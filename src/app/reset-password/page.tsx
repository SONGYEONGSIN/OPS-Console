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
    // 임시 session 가드 — /auth/callback을 거친 경우 user 활성. 이미 로그인된 사용자도 통과(의도된 허용).
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
        <span>운영부</span>
        <span className="text-faint">/</span>
        <span>인증</span>
        <span className="text-faint">/</span>
        <strong className="font-semibold text-ink">비밀번호 재설정</strong>
      </nav>

      <h2 className="mb-2 text-2xl font-semibold tracking-[-0.02em]">비밀번호 재설정</h2>
      <p className="mb-6 text-sm leading-[1.6] text-muted">
        안전한 새 비밀번호를 입력하세요. 변경 후 자동으로 로그인됩니다.
      </p>

      <form action={formAction} noValidate className="flex flex-col gap-4">
        {state?.error && (
          <p role="alert" className="text-xs text-vermilion">
            {state.error}
          </p>
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
    { label: "대문자", ok: /[A-Z]/.test(value) },
    { label: "숫자", ok: /[0-9]/.test(value) },
    {
      label: "특수문자",
      ok: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/.test(value),
    },
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

function PasswordMatchIndicator({ pw, confirm }: { pw: string; confirm: string }) {
  if (!confirm) return null;
  const ok = pw === confirm;
  return (
    <div className={`mt-2 text-sm ${ok ? "font-bold text-sage" : "font-medium text-vermilion"}`}>
      <span className="mr-1.5">{ok ? "✓" : "✗"}</span>
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
