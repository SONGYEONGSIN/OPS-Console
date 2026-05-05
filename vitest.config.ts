import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      // 테스트 환경에서는 RSC 마커가 의미 없으므로 no-op 으로 치환.
      // (Next.js 프로덕션 런타임은 별도 webpack alias 로 정상 동작)
      // server-only 패키지의 exports field에 ./empty subpath가 없어 직접 파일 경로로 매핑.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["**/node_modules/**", "**/e2e/**", "**/.next/**"],
  },
});
