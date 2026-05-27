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
