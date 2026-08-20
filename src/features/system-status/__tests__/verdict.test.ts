import { describe, it, expect } from "vitest";
import { judgePoller, type PollerSample } from "../verdict";

const NOW = new Date("2026-08-21T10:00:00Z");
const minsAgo = (m: number) =>
  new Date(NOW.getTime() - m * 60_000).toISOString();

const sample = (over: Partial<PollerSample> = {}): PollerSample => ({
  pendingCount: 0,
  oldestPendingAt: null,
  runningCount: 0,
  oldestRunningAt: null,
  lastClaimAt: null,
  lastRequestAt: null,
  ...over,
});

describe("폴러 판정", () => {
  it("대기가 임계를 넘으면 멈춘 것이다", () => {
    const r = judgePoller(
      sample({ pendingCount: 1, oldestPendingAt: minsAgo(30) }),
      2,
      NOW,
    );
    expect(r.verdict).toBe("stopped");
    expect(r.detail).toMatch(/30분/);
  });

  it("대기가 아직 임계 안이면 처리 중이다", () => {
    const r = judgePoller(
      sample({ pendingCount: 1, oldestPendingAt: minsAgo(1) }),
      2,
      NOW,
    );
    expect(r.verdict).toBe("working");
  });

  it("가져간 뒤 안 끝내도 멈춘 것이다 — 폴러가 일하다 죽었다", () => {
    const r = judgePoller(
      sample({ runningCount: 1, oldestRunningAt: minsAgo(40) }),
      2,
      NOW,
    );
    expect(r.verdict).toBe("stopped");
  });

  it("대기가 없으면 '모름'이다 — 살았다고 말하지 않는다", () => {
    // 요청이 없으면 claim 도 없다. 조용한 것과 죽은 것은 구분되지 않는다.
    const r = judgePoller(
      sample({ lastClaimAt: minsAgo(3000), lastRequestAt: minsAgo(3000) }),
      2,
      NOW,
    );
    expect(r.verdict).toBe("unknown");
    expect(r.detail).toMatch(/대기 중인 요청이 없/);
  });

  it("모를 때는 마지막으로 가져간 시각을 알려준다 — 그것만이 유일한 단서다", () => {
    const r = judgePoller(
      sample({ lastClaimAt: minsAgo(2880), lastRequestAt: minsAgo(2900) }),
      2,
      NOW,
    );
    expect(r.detail).toMatch(/2일 전/);
  });

  it("한 번도 안 쓴 폴러도 '모름'이다", () => {
    const r = judgePoller(sample(), 2, NOW);
    expect(r.verdict).toBe("unknown");
  });

  it("임계는 폴러마다 다르다 — 상주(2분)와 5분 폴링을 같이 볼 수 없다", () => {
    const s = sample({ pendingCount: 1, oldestPendingAt: minsAgo(6) });
    expect(judgePoller(s, 2, NOW).verdict).toBe("stopped");
    expect(judgePoller(s, 10, NOW).verdict).toBe("working");
  });

  it("대기 건수를 함께 알려준다 — 몇 건이 밀렸는지가 급한 정도다", () => {
    const r = judgePoller(
      sample({ pendingCount: 4, oldestPendingAt: minsAgo(30) }),
      2,
      NOW,
    );
    expect(r.detail).toMatch(/4건/);
  });

  it("멈춤 판정은 가장 오래 기다린 것을 기준으로 한다", () => {
    // 최근 요청이 섞여 들어와도 판정이 흐려지면 안 된다.
    const r = judgePoller(
      sample({ pendingCount: 2, oldestPendingAt: minsAgo(30) }),
      2,
      NOW,
    );
    expect(r.verdict).toBe("stopped");
  });
});
