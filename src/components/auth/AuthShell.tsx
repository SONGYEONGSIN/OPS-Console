"use client";

import { AuthTitleBar, AuthStatusBar } from "./AuthChrome";

/**
 * forgot-password / reset-password 페이지의 공통 셸.
 *
 * Layout: AuthTitleBar (검정 상단) + 중앙 정렬 폼 영역 + AuthStatusBar (검정 하단).
 * 로그인 페이지와 chrome 동일.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 grid h-screen grid-rows-[34px_1fr_26px]">
      <AuthTitleBar />
      <main className="flex items-center justify-center overflow-y-auto bg-cream px-4 py-5 md:px-5 md:py-6 lg:px-7 lg:py-8">
        <div className="w-full max-w-[420px]">{children}</div>
      </main>
      <AuthStatusBar />
    </div>
  );
}
