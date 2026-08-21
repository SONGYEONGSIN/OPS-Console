import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * `CRON_SECRET` 으로 지키는 endpoint 는 인증 가드에서 빼야 한다.
 *
 * 빼지 않으면 `proxy.ts` 가 **307 로 /login 에 돌려보낸다.** 라우트는 멀쩡한데
 * 호출자는 리다이렉트만 받는다 — 타입 검사도 테스트도 못 잡고, 배포 후에야
 * 드러난다. 심박(`/api/pollers/heartbeat`)이 그렇게 한 번 걸렸다(2026-08-21).
 *
 * 새 폴러 창구를 만들면 이 테스트가 파일을 짚어 실패한다.
 */
const proxy = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");

/** 폴러·cron 이 부르는 창구. 세션이 없으므로 전부 공개 경로여야 한다. */
const CRON_ROUTES = [
  "/api/pollers/heartbeat",
  "/api/assistant/claude/claim",
  "/api/postal/extract",
  "/api/automations/run",
  "/api/closing/run-log",
];

describe("proxy — CRON_SECRET 창구", () => {
  it("전부 PUBLIC_PATHS 에 있다", () => {
    const missing = CRON_ROUTES.filter((r) => !proxy.includes(`"${r}"`));
    expect(
      missing,
      `PUBLIC_PATHS 에 없으면 307로 /login 에 돌려보냅니다:\n${missing.join("\n")}`,
    ).toEqual([]);
  });
});
