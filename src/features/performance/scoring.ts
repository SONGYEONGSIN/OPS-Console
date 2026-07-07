/**
 * 성과 점수 산출 (순수함수, UI/DB 무관).
 * 최종 = 성과지표(≤80) + 관리자 루브릭(≤20) = 0~100 → 등급.
 */
import type { Grade } from "./schemas";

/** 성과지표 가중치 합(정수 points). */
export const METRIC_WEIGHT_TOTAL = 80;
/** 관리자 루브릭 최대 기여도. */
export const RUBRIC_MAX = 20;
/** 루브릭 각 항목 척도 (1~5). */
export const RUBRIC_SCALE = 5;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** 성과지표 가중치 합이 정확히 80인지 (정수 비교 — 부동소수 오차 회피). */
export function isValidMetricWeights(weights: number[]): boolean {
  return weights.reduce((s, w) => s + w, 0) === METRIC_WEIGHT_TOTAL;
}

/** 성과 기여도 = Σ(weight_i × 달성률_i/100), 달성률 0~100 clamp → 최대 80. */
export function performanceContribution(
  metrics: { weight: number; achievement: number }[],
): number {
  return metrics.reduce(
    (s, m) => s + (m.weight * clamp(m.achievement, 0, 100)) / 100,
    0,
  );
}

/** 루브릭 기여도 = (평균 1~5 / 5) × 20. 빈 배열이면 0. */
export function rubricContribution(scores: number[]): number {
  if (scores.length === 0) return 0;
  const avg =
    scores.reduce((s, v) => s + clamp(v, 1, RUBRIC_SCALE), 0) / scores.length;
  return (avg / RUBRIC_SCALE) * RUBRIC_MAX;
}

/** 최종 점수 = 성과(≤80) + 루브릭(≤20). 소수 1자리 반올림. */
export function finalScore(
  metrics: { weight: number; achievement: number }[],
  rubricScores: number[],
): number {
  const raw =
    performanceContribution(metrics) + rubricContribution(rubricScores);
  return Math.round(raw * 10) / 10;
}

/** 점수 → 등급 (S≥90 / A≥80 / B≥70 / C≥60 / D<60). */
export function scoreToGrade(score: number): Grade {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}
