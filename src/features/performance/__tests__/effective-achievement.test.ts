import { describe, it, expect } from "vitest";
import { effectiveAchievement } from "../effective-achievement";

/**
 * 화면에 쓰는 달성률 한 값 — 자동 계산과 손입력 중 무엇을 쓸지 정한다.
 *
 * 목표값이 생기기 전까지 `achievement` 는 **사람이 손으로 넣는 값**이었고,
 * 그 데이터가 이미 쌓여 있다. 목표를 넣기 시작해도 옛 지표가 0점이 되면 안 된다.
 */
describe("effectiveAchievement", () => {
  it("목표와 실적이 있으면 계산값을 쓴다", () => {
    const r = effectiveAchievement({
      target: 20,
      actual: 15,
      manual: 99,
      lowerIsBetter: false,
    });
    expect(r.value).toBe(75);
    expect(r.source).toBe("auto");
  });

  /**
   * 계산이 손입력을 이긴다. 목표를 등록해 두고도 옛 손입력이 남아 있으면
   * 화면과 실제가 갈린다 — 목표가 있다는 건 "이걸로 재겠다"는 선언이다.
   */
  it("계산이 되면 손입력을 덮는다", () => {
    const r = effectiveAchievement({
      target: 20,
      actual: 30,
      manual: 10,
      lowerIsBetter: false,
    });
    expect(r.value).toBe(100);
    expect(r.source).toBe("auto");
  });

  it("목표가 없으면 손입력을 쓴다 — 옛 지표가 0점이 되면 안 된다", () => {
    const r = effectiveAchievement({
      target: null,
      actual: 15,
      manual: 60,
      lowerIsBetter: false,
    });
    expect(r.value).toBe(60);
    expect(r.source).toBe("manual");
  });

  it("실적을 못 셌으면 손입력을 쓴다 — 집계 못 하는 지표가 있다", () => {
    const r = effectiveAchievement({
      target: 20,
      actual: null,
      manual: 40,
      lowerIsBetter: false,
    });
    expect(r.value).toBe(40);
    expect(r.source).toBe("manual");
  });

  /**
   * 둘 다 없으면 0 이되 그 사실을 밝힌다. 0 을 그냥 돌려주면 '못 했다'로
   * 읽히는데 실제로는 '아직 아무 근거가 없다'이다.
   */
  it("둘 다 없으면 0 이고 근거 없음으로 표시한다", () => {
    const r = effectiveAchievement({
      target: null,
      actual: null,
      manual: null,
      lowerIsBetter: false,
    });
    expect(r.value).toBe(0);
    expect(r.source).toBe("none");
  });

  it("낮을수록 좋은 지표도 계산한다", () => {
    const r = effectiveAchievement({
      target: 10,
      actual: 20,
      manual: null,
      lowerIsBetter: true,
    });
    expect(r.value).toBe(50);
    expect(r.source).toBe("auto");
  });
});
