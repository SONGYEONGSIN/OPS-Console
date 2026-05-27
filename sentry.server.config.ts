/**
 * Sentry 서버(Node.js runtime) 초기화. instrumentation.ts에서 register() 시 자동 import.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_GIT_SHA,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
});
