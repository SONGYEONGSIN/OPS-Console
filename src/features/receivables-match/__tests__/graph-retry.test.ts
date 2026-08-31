import { describe, it, expect } from "vitest";
import { isTransient, RETRY_DELAYS_MS } from "../graph-retry";

/**
 * Graph 가 일시적으로 실패했는가.
 *
 * 2026-08-31 09:01·10:00 입금 매칭이 실패했는데 **11:00 에는 그냥 됐다.** 파일도
 * 시트도 멀쩡했다. 그런데 실패 문구가 "파일 이동/이름변경/권한"을 먼저 말해서
 * 휴지통까지 뒤지게 만들었다 — 사실은 잠깐 흔들린 것뿐이었다.
 *
 * 일시 오류는 **한 번 더 해보면** 대개 지나간다. 그래야 알림도 안 뜬다.
 */
describe("isTransient", () => {
  it("429·5xx 는 일시 오류다", () => {
    for (const s of [429, 500, 502, 503, 504]) expect(isTransient(s), String(s)).toBe(true);
  });

  it("404 는 다시 해도 소용없다 — 파일이 없는 것이다", () => {
    expect(isTransient(404)).toBe(false);
  });

  it("401·403 도 재시도 대상이 아니다 — 권한·토큰 문제다", () => {
    expect(isTransient(401)).toBe(false);
    expect(isTransient(403)).toBe(false);
  });

  it("200 은 애초에 실패가 아니다", () => {
    expect(isTransient(200)).toBe(false);
  });

  it("재시도 간격은 늘어난다 — 흔들리는 쪽을 몰아붙이지 않는다", () => {
    expect(RETRY_DELAYS_MS.length).toBeGreaterThan(0);
    for (let i = 1; i < RETRY_DELAYS_MS.length; i++) {
      expect(RETRY_DELAYS_MS[i]).toBeGreaterThan(RETRY_DELAYS_MS[i - 1]);
    }
  });

  it("전부 합쳐도 cron 주기(1시간)보다 훨씬 짧다 — 다음 실행을 밀지 않는다", () => {
    const total = RETRY_DELAYS_MS.reduce((a, b) => a + b, 0);
    expect(total).toBeLessThan(60_000);
  });
});
