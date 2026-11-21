import { describe, it, expect } from "vitest";
import { config } from "@/proxy";

/**
 * 회사 PC 폴러가 2~3초·1분마다 부르는 창구는 미들웨어를 아예 안 태운다.
 *
 * Vercel 은 미들웨어도 함수 호출로 센다 — 요청 1건이 호출 2회가 된다(실측
 * 8/24~9/23: CDN 요청 2.38M ↔ 함수 호출 4.76M). 이 창구들은 어차피
 * PUBLIC_PATHS 라 미들웨어가 세션만 읽고 통과시키므로 하는 일이 없다.
 * 인증은 라우트 안에서 CRON_SECRET 으로 한다.
 */
const matchers = config.matcher.map((m) => new RegExp(`^${m}$`));
const runsProxy = (path: string) => matchers.some((re) => re.test(path));

describe("proxy matcher — 폴러 창구 제외", () => {
  it.each([
    "/api/assistant/claude/claim",
    "/api/postal/extract",
    "/api/pollers/heartbeat",
  ])("%s 는 미들웨어를 안 탄다", (path) => {
    expect(runsProxy(path)).toBe(false);
  });

  it.each([
    "/dashboard",
    "/login",
    // 웹 창구는 세션이 필요하다 — 접두사가 같아도 제외되면 안 된다.
    "/api/assistant/claude",
    "/api/assistant/claude/claimed",
    "/api/postal/extract-other",
    "/api/pollers",
  ])("%s 는 미들웨어를 탄다", (path) => {
    expect(runsProxy(path)).toBe(true);
  });
});
