/**
 * Sentry Edge runtime(미들웨어/edge routes) 초기화.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_GIT_SHA,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
});
