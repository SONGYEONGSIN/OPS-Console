import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import { withSentryConfig } from "@sentry/nextjs";
import pkg from "./package.json" with { type: "json" };

function gitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
}

const nextConfig: NextConfig = {
  experimental: {
    /**
     * 서버 액션 본문 상한 — 기본 1MB 는 영수증 사진에 모자란다.
     *
     * `features/postal/upload-guard.ts` 의 `SERVER_ACTION_BODY_LIMIT` 과 같은 값을
     * 유지한다. 어긋나면 화면은 통과라 하고 서버가 거절해, 사용자에게 아무 말도
     * 안 나온 채 콘솔 오류만 남는다(2026-08-21).
     */
    serverActions: { bodySizeLimit: "12mb" },
  },
  env: {
    NEXT_PUBLIC_BUILD_VERSION: pkg.version,
    NEXT_PUBLIC_GIT_SHA: process.env.NEXT_PUBLIC_GIT_SHA ?? gitSha(),
  },
};

/**
 * Sentry 통합 — Source Map 업로드(SENTRY_AUTH_TOKEN 필요) + tunneling으로 ad-blocker 회피.
 * DSN/AUTH 미설정 시 Sentry는 no-op (빌드 실패 X).
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Source map은 production 빌드에서만 업로드 (dev 빌드 시 disable)
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  // ad-blocker가 sentry.io 호출 차단할 때 우회
  tunnelRoute: "/monitoring",
  // 큰 dep tree warning 억제
  widenClientFileUpload: true,
  disableLogger: true,
});
