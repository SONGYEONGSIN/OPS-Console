import { describe, it, expect } from "vitest";
import {
  METRIC_WEIGHT_TOTAL,
  isValidMetricWeights,
  performanceContribution,
  rubricContribution,
  finalScore,
  scoreToGrade,
} from "../scoring";

describe("isValidMetricWeights", () => {
  it("합이 정확히 80이면 true (이미지의 40/20/20)", () => {
    expect(isValidMetricWeights([40, 20, 20])).toBe(true);
    expect(isValidMetricWeights([80])).toBe(true);
    expect(METRIC_WEIGHT_TOTAL).toBe(80);
  });
  it("합이 80이 아니면 false", () => {
    expect(isValidMetricWeights([40, 20, 10])).toBe(false); // 70
    expect(isValidMetricWeights([40, 30, 20])).toBe(false); // 90
    expect(isValidMetricWeights([])).toBe(false); // 0
  });
});

describe("performanceContribution", () => {
  it("모든 달성 100%면 가중치 합(=80)", () => {
    expect(
      performanceContribution([
        { weight: 40, achievement: 100 },
        { weight: 20, achievement: 100 },
        { weight: 20, achievement: 100 },
      ]),
    ).toBe(80);
  });
  it("달성률 가중 반영 (40*50% + 20*100% + 20*0% = 40)", () => {
    expect(
      performanceContribution([
        { weight: 40, achievement: 50 },
        { weight: 20, achievement: 100 },
        { weight: 20, achievement: 0 },
      ]),
    ).toBe(40);
  });
  it("달성률은 0~100으로 clamp", () => {
    expect(performanceContribution([{ weight: 80, achievement: 150 }])).toBe(80);
    expect(performanceContribution([{ weight: 80, achievement: -10 }])).toBe(0);
  });
});

describe("rubricContribution", () => {
  it("전부 5점이면 최대 20", () => {
    expect(rubricContribution([5, 5, 5])).toBe(20);
  });
  it("평균 3점이면 12 (3/5*20)", () => {
    expect(rubricContribution([3, 3, 3])).toBe(12);
  });
  it("빈 배열이면 0", () => {
    expect(rubricContribution([])).toBe(0);
  });
});

describe("finalScore", () => {
  it("성과 만점 + 루브릭 만점 = 100", () => {
    expect(
      finalScore(
        [
          { weight: 40, achievement: 100 },
          { weight: 40, achievement: 100 },
        ],
        [5, 5, 5],
      ),
    ).toBe(100);
  });
  it("성과40 + 루브릭12 = 52", () => {
    expect(
      finalScore([{ weight: 80, achievement: 50 }], [3, 3, 3]),
    ).toBe(52);
  });
});

describe("scoreToGrade", () => {
  it("경계값 S/A/B/C/D", () => {
    expect(scoreToGrade(90)).toBe("S");
    expect(scoreToGrade(89.9)).toBe("A");
    expect(scoreToGrade(80)).toBe("A");
    expect(scoreToGrade(70)).toBe("B");
    expect(scoreToGrade(60)).toBe("C");
    expect(scoreToGrade(59.9)).toBe("D");
    expect(scoreToGrade(0)).toBe("D");
  });
});
