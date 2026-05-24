/**
 * 개인 활동 지표 (성과지표 80% 중 20%) — worklog + services 담당 + todos 완료
 * + my-ai-work 등록 + incidents 처리 5 도메인의 단순 합산.
 *
 * 1차 PR placeholder — 가중치 환산식(예: worklog *0.5, services *2 등)은
 * 사용자 실데이터 검토 후 follow-up PR에서 조정.
 *
 * server query 합성(supabase 호출)은 별도 file로 분리 예정 — 본 모듈은
 * 순수 함수만 두어 unit test 가능 + side effect 격리.
 */

export type ActivityCounts = {
  worklog: number;
  services: number;
  todosDone: number;
  aiWork: number;
  incidentsResolved: number;
};

export type ActivityScore = {
  total: number;
  breakdown: ActivityCounts;
};

function clampNonNegative(n: number): number {
  return n < 0 ? 0 : n;
}

/** 5 도메인 카운트 → 점수 (1차는 단순 합, 음수는 0으로 clamp). */
export function activityScore(counts: ActivityCounts): ActivityScore {
  const breakdown: ActivityCounts = {
    worklog: clampNonNegative(counts.worklog),
    services: clampNonNegative(counts.services),
    todosDone: clampNonNegative(counts.todosDone),
    aiWork: clampNonNegative(counts.aiWork),
    incidentsResolved: clampNonNegative(counts.incidentsResolved),
  };
  const total =
    breakdown.worklog +
    breakdown.services +
    breakdown.todosDone +
    breakdown.aiWork +
    breakdown.incidentsResolved;
  return { total, breakdown };
}
