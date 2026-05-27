import * as Sentry from "@sentry/nextjs";

/**
 * Next.js 13+ instrumentation hook — 서버 시작 시 1회 실행.
 * Sentry server/edge runtime 초기화 진입점.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

/** Next.js 15+ — Server Component 에러를 Sentry로 캡처. SDK가 onRequestError export. */
export const onRequestError = Sentry.captureRequestError;
