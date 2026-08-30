import { achievementOf } from "./achievement";

/**
 * 화면·채점에 쓸 달성률 하나 — 자동 계산과 손입력 중 무엇을 쓸지 정한다.
 *
 * 목표값이 생기기 전까지 `achievement` 는 **사람이 손으로 넣는 값**이었고 그
 * 데이터가 이미 쌓여 있다. 목표를 넣기 시작해도 옛 지표가 0점이 되면 안 된다.
 *
 * **계산이 손입력을 이긴다.** 목표를 등록했다는 건 "이걸로 재겠다"는 선언이라,
 * 옛 손입력이 남아 화면과 실제가 갈리면 안 된다.
 */
export type AchievementSource = "auto" | "manual" | "none";

export function effectiveAchievement({
  target,
  actual,
  manual,
  lowerIsBetter,
}: {
  target: number | null;
  /** aggregator 가 집계한 실적. 못 세는 지표면 null. */
  actual: number | null;
  /** 사람이 넣어 둔 값. */
  manual: number | null;
  lowerIsBetter: boolean;
}): { value: number; source: AchievementSource } {
  const auto = achievementOf({ actual, target, lowerIsBetter });
  if (auto !== null) return { value: auto, source: "auto" };
  if (manual !== null) return { value: manual, source: "manual" };
  // 0 을 그냥 돌려주면 '못 했다'로 읽힌다 — 실제로는 '아직 근거가 없다'다.
  return { value: 0, source: "none" };
}
