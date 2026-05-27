/**
 * Sentry 클라이언트 (브라우저) 초기화.
 * Next.js App Router는 instrumentation-client.ts 자동 로드. dsn은 NEXT_PUBLIC_ prefix 필수.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_GIT_SHA,
  // 트랜잭션 샘플링 — 운영에서 비용 통제. 0.1 = 10%.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  // 세션 리플레이는 비활성 (개인정보 / 비용)
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  // ResizeObserver loop 등 무해한 브라우저 노이즈 필터
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "Non-Error promise rejection captured",
  ],
});
