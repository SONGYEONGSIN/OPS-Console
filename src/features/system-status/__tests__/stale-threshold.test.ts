import { describe, it, expect } from "vitest";
import { judgePoller } from "../verdict";
import { POLLERS } from "../pollers";

const NOW = new Date("2026-08-21T00:00:00Z");
const agoMin = (m: number) =>
  new Date(NOW.getTime() - m * 60_000).toISOString();

const quiet = {
  pendingCount: 0,
  oldestPendingAt: null,
  runningCount: 0,
  oldestRunningAt: null,
  lastClaimAt: null,
  lastRequestAt: null,
};

/**
 * 심박 임계는 폴러마다 다르다.
 *
 * 상주 폴러는 1분마다 보내지만 PowerShell 폴러는 **5분마다 한 번 돌고 끝난다** —
 * 그때 한 줄 남기는 게 심박이다. 상주 기준(5분)을 그대로 쓰면 **정상인데도 늘 멈춤**
 * 으로 뜬다. 오탐이 한 번 나면 화면 전체를 안 믿게 된다.
 */
describe("폴러별 심박 임계", () => {
  it("모든 폴러가 임계를 갖는다", () => {
    for (const p of POLLERS) {
      expect(p.heartbeatStaleMinutes, p.id).toBeGreaterThan(0);
    }
  });

  it("5분 간격 폴러는 5분 무소식으로 죽었다 하지 않는다", () => {
    const p = POLLERS.find((x) => x.id === "ratio-audit");
    expect(p).toBeDefined();
    const j = judgePoller(
      { ...quiet, lastBeatAt: agoMin(6) },
      p!.thresholdMinutes,
      NOW,
      p!.heartbeatStaleMinutes,
    );
    expect(j.verdict).toBe("working");
  });

  it("그래도 오래 끊기면 잡는다", () => {
    const p = POLLERS.find((x) => x.id === "ratio-audit")!;
    const j = judgePoller(
      { ...quiet, lastBeatAt: agoMin(p.heartbeatStaleMinutes + 1) },
      p.thresholdMinutes,
      NOW,
      p.heartbeatStaleMinutes,
    );
    expect(j.verdict).toBe("stopped");
  });

  it("상주 폴러는 짧게 본다 — 1분마다 보내므로 5분이면 네 번을 놓친 것이다", () => {
    const p = POLLERS.find((x) => x.id === "assistant")!;
    expect(p.heartbeatStaleMinutes).toBeLessThanOrEqual(5);
  });

  it("5분 폴러 임계는 주기의 두 배를 넘는다 — 한 번 걸렀다고 죽었다 하지 않는다", () => {
    for (const id of ["ratio-audit", "closing-scrape", "entertest", "dev-control"]) {
      const p = POLLERS.find((x) => x.id === id)!;
      expect(p.heartbeatStaleMinutes, id).toBeGreaterThan(10);
    }
  });
});
