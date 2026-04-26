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
        <span>운영부</span>
        <span className="text-faint">/</span>
        <span>인증</span>
        <span className="text-faint">/</span>
        <strong className="font-semibold text-ink">비밀번호 찾기</strong>
      </nav>

      <h2 className="mb-2 text-2xl font-semibold tracking-[-0.02em]">
        비밀번호 찾기
      </h2>
      <p className="mb-6 text-sm leading-[1.6] text-muted">
        가입 이메일을 입력하면 재설정 링크를 보내드립니다.
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
              placeholder="jinhakID@jinhakapply.com"
              className="w-full border-none bg-transparent py-3 text-md tracking-[-0.005em] text-ink outline-none placeholder:text-faint [line-height:normal]"
            />
          </div>
        </div>

        <SubmitButton />

        <Link
          href="/login"
          className="mt-2 inline-flex items-center self-start text-sm tracking-[0.02em] text-muted no-underline transition-colors hover:text-vermilion min-h-[var(--tap-min)]"
        >
          ← 로그인으로 돌아가기
        </Link>
      </form>
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
