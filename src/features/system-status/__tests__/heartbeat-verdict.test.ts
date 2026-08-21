import { describe, it, expect } from "vitest";
import { judgePoller, HEARTBEAT_STALE_MINUTES } from "../verdict";

const NOW = new Date("2026-08-21T00:00:00Z");
const agoMin = (m: number) =>
  new Date(NOW.getTime() - m * 60_000).toISOString();

const quiet = {
  pendingCount: 0,
  oldestPendingAt: null,
  runningCount: 0,
  oldestRunningAt: null,
  lastClaimAt: agoMin(600),
  lastRequestAt: agoMin(600),
};

/**
 * 심박으로 조용한 폴러와 죽은 폴러를 가른다.
 *
 * 큐 기록만 보면 **요청이 없을 때** 둘을 구분할 수 없다. 2026-08-20 밤 어시스턴트
 * 폴러가 죽었는데 20:49 질문이 12시간 뒤에야 답을 받았고, 그 사이 화면은
 * 'unknown'만 보여줬다 — 아무도 모르는 게 정상인 상태였다.
 */
describe("judgePoller — 심박", () => {
  it("대기가 없어도 심박이 살아 있으면 정상이다", () => {
    const j = judgePoller({ ...quiet, lastBeatAt: agoMin(1) }, 2, NOW);
    expect(j.verdict).toBe("working");
    expect(j.detail).toMatch(/살아/);
  });

  it("심박이 끊기면 멈춘 것이다 — 요청이 없어도 안다", () => {
    const j = judgePoller(
      { ...quiet, lastBeatAt: agoMin(HEARTBEAT_STALE_MINUTES + 1) },
      2,
      NOW,
    );
    expect(j.verdict).toBe("stopped");
    expect(j.detail).toMatch(/소식이 없/);
  });

  it("심박을 안 보내는 폴러는 예전대로 unknown — 거짓 안심을 주지 않는다", () => {
    // PowerShell 폴러들은 아직 심박을 안 보낸다. 그걸 '정상'이라 하면 안 된다.
    const j = judgePoller({ ...quiet, lastBeatAt: null }, 2, NOW);
    expect(j.verdict).toBe("unknown");
  });

  it("큐 증거가 심박보다 세다 — 살아 있다고 보고하면서 일을 안 할 수 있다", () => {
    const j = judgePoller(
      {
        ...quiet,
        lastBeatAt: agoMin(1),
        pendingCount: 1,
        oldestPendingAt: agoMin(30),
      },
      2,
      NOW,
    );
    expect(j.verdict).toBe("stopped");
    expect(j.detail).toMatch(/대기 중/);
  });
});
