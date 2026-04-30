import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// Playwright는 Node 셸 env만 읽음 — `.env.local`을 명시적으로 로드해야
// spec의 `process.env.TEST_USER_EMAIL` 등이 정의됨. (Next.js webServer는 별도로 자체 로드.)
loadEnv({ path: ".env.local" });

// E2E_BASE_URL이 지정되면 사용자가 이미 띄운 dev 서버에 붙는다 (webServer 비활성).
// 미지정이면 Playwright가 직접 3010에 dev 서버 기동.
const E2E_BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3010";
const useExternalServer = !!process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    // 포트 3010 — port 3000은 다른 OPSROOM 프로젝트(Nexus)가 점유할 수 있어 e2e용 별도 분리
    baseURL: E2E_BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: useExternalServer
    ? undefined
    : {
        command: "next dev -p 3010",
        url: "http://localhost:3010",
        reuseExistingServer: !process.env.CI,
        timeout: 60000,
      },
});
