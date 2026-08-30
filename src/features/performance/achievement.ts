/**
 * 목표 대비 달성률.
 *
 * 지금까지 `achievement` 는 **사람이 손으로 넣는 값**이었다. 목표값이 없어서
 * 계산할 근거가 없었기 때문이다("목표 기반 리포트"가 성립하지 않던 이유).
 * 정량 지표는 실적/목표로 저절로 나와야 한다.
 *
 * 순수 함수로 둔 이유: 0·null·역방향 지표처럼 조용히 틀리기 쉬운 자리다.
 */

export function achievementOf({
  actual,
  target,
  lowerIsBetter = false,
}: {
  /** 집계된 실적. 아직 못 셌으면 null. */
  actual: number | null;
  /** 등록된 목표. 없으면 null. */
  target: number | null;
  /** 줄이는 게 목표인 지표(사고 건수·처리 시간). */
  lowerIsBetter?: boolean;
}): number | null {
  // 목표가 없으면 계산하지 않는다. 0 은 '아무것도 못 했다', 100 은 '다 했다'로
  // 읽히는데 둘 다 거짓이다.
  if (actual === null || target === null) return null;
  // 목표 0 은 나눌 수 없다. 등록 화면이 막지만 옛 데이터가 들어올 수 있다.
  if (target === 0) return null;

  const raw = lowerIsBetter
    ? // 적을수록 잘한 것 — 0 이면 만점.
      actual === 0
      ? 100
      : (target / actual) * 100
    : (actual / target) * 100;

  // 목표를 넘어도 100 을 넘기지 않는다 — 한 지표가 다른 지표를 덮으면 안 된다.
  return Math.round(Math.min(raw, 100) * 10) / 10;
}
