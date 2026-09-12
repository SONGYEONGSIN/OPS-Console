import { defineConfig } from "vitest/config";
import { createRequire } from "node:module";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// 설정 파일 위치를 기준으로 node 해석을 태운다 — 경로를 적지 않는다.
// 전에는 `./node_modules/next/…` 를 이 파일 옆에 있다고 적었는데, worktree 는
// 자기 node_modules 가 없고 상위 체크아웃 것을 쓴다. 그래서 worktree 에서는
// 이 경로가 통째로 존재하지 않아 `server-only` 를 import 하는 파일이 든 테스트가
// 전부 resolve 에러로 죽었다. require.resolve 는 상위로 올라가며 찾으므로
// 어느 체크아웃에서도 같은 파일을 가리킨다.
const requireFromConfig = createRequire(import.meta.url);

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      // 테스트 환경에서는 RSC 마커가 의미 없으므로 no-op 으로 치환.
      // (Next.js 프로덕션 런타임은 별도 webpack alias 로 정상 동작)
      // server-only 패키지는 next 에 bundled 되어 있어 next 내부 empty.js 로 매핑.
      "server-only": requireFromConfig.resolve(
        "next/dist/compiled/server-only/empty.js",
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
