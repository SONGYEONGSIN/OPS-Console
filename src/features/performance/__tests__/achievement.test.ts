import { describe, it, expect } from "vitest";
import { achievementOf } from "../achievement";

/**
 * "목표 기반 실시간 리포트"의 핵심 한 줄.
 *
 * 지금까지 달성률(`achievement`)은 **사람이 손으로 넣는 값**이었다. 목표값
 * (`target_value`)이 없어서 계산할 근거가 없었기 때문이다. 정량 지표는
 * 실적/목표로 저절로 나와야 한다.
 */
describe("achievementOf", () => {
  it("실적 ÷ 목표 × 100", () => {
    expect(achievementOf({ actual: 15, target: 20 })).toBe(75);
  });

  it("목표를 넘어도 100 을 넘기지 않는다 — 한 지표가 다른 지표를 덮으면 안 된다", () => {
    expect(achievementOf({ actual: 40, target: 20 })).toBe(100);
  });

  it("소수는 한 자리로 — 화면에 62.33333% 를 띄우지 않는다", () => {
    expect(achievementOf({ actual: 187, target: 300 })).toBe(62.3);
  });

  /**
   * 목표가 없으면 계산하지 않는다. 0 을 돌려주면 '아무것도 못 했다'로 읽히고,
   * 100 을 돌려주면 '다 했다'로 읽힌다 — 둘 다 거짓이다.
   */
  it("목표가 없으면 null — 0 도 100 도 거짓말이다", () => {
    expect(achievementOf({ actual: 15, target: null })).toBeNull();
  });

  it("실적을 아직 못 셌으면 null", () => {
    expect(achievementOf({ actual: null, target: 20 })).toBeNull();
  });

  /**
   * 목표 0 은 나눌 수 없다. 등록 화면이 막지만, 옛 데이터나 손으로 넣은 값이
   * 들어올 수 있어 여기서도 막는다.
   */
  it("목표가 0 이면 null — 나눌 수 없다", () => {
    expect(achievementOf({ actual: 5, target: 0 })).toBeNull();
  });

  it("실적 0 은 0% 다 — 못 센 것과 다르다", () => {
    expect(achievementOf({ actual: 0, target: 20 })).toBe(0);
  });

  /**
   * 줄이는 게 목표인 지표가 있다(사고 건수·처리 시간). 그때는 적을수록 잘한 것이다.
   */
  it("낮을수록 좋은 지표는 뒤집어 센다", () => {
    // 목표 10건 이하인데 5건 → 초과 달성
    expect(achievementOf({ actual: 5, target: 10, lowerIsBetter: true })).toBe(
      100,
    );
    // 목표 10건인데 20건 → 절반만 지킨 셈
    expect(achievementOf({ actual: 20, target: 10, lowerIsBetter: true })).toBe(
      50,
    );
  });

  it("낮을수록 좋은데 실적이 0 이면 만점", () => {
    expect(achievementOf({ actual: 0, target: 10, lowerIsBetter: true })).toBe(
      100,
    );
  });
});
