import { describe, it, expect } from "vitest";
import { agentStatus } from "../agent-status";

/**
 * 인스펙터 머리의 상태 뱃지 — 표준 인스펙터가 모두 갖고 있는 자리다.
 *
 * **아무 말이나 채우면 안 된다.** '가동'이라고 적어 놓고 실제로는 한 달째
 * 안 돈 잡이면, 그 뱃지가 사람을 속인다. 아는 것만 적는다.
 */
describe("agentStatus", () => {
  it("예정 자리는 예정이다", () => {
    expect(agentStatus({ planned: true })).toEqual({
      label: "예정",
      ring: "bg-muted",
    });
  });

  it("폴러가 멈췄으면 멈춤 — 눈에 걸려야 한다", () => {
    expect(agentStatus({ verdict: "stopped" })).toEqual({
      label: "멈춤",
      ring: "bg-vermilion",
    });
  });

  it("폴러가 돌고 있으면 처리 중", () => {
    expect(agentStatus({ verdict: "working" })).toEqual({
      label: "처리 중",
      ring: "bg-sage",
    });
  });

  /** 잡은 심박이 없다. 최근에 돈 기록이 있으면 도는 것으로 본다. */
  it("최근에 돈 잡은 가동이다", () => {
    expect(agentStatus({ lastAt: "2026-08-30T10:00:00+09:00" })).toEqual({
      label: "가동",
      ring: "bg-sage",
    });
  });

  /**
   * 기록이 없으면 '가동'이라고 적지 않는다 — 한 달째 안 돈 잡을 초록으로
   * 그리면 뱃지가 사람을 속인다.
   */
  it("최근 기록이 없으면 가동이라고 하지 않는다", () => {
    expect(agentStatus({})).toEqual({ label: "기록 없음", ring: "bg-muted" });
  });

  /** 멈춤이 가장 급하다 — 다른 조건보다 먼저 본다. */
  it("멈춤은 다른 무엇보다 먼저다", () => {
    expect(
      agentStatus({ verdict: "stopped", lastAt: "2026-08-30T10:00:00+09:00" })
        .label,
    ).toBe("멈춤");
  });
});
