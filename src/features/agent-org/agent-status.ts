/**
 * 인스펙터 머리의 상태 뱃지 — 표준 인스펙터가 모두 갖고 있는 자리다.
 *
 * **아무 말이나 채우면 안 된다.** '가동'이라고 적어 놓고 실제로는 한 달째 안
 * 돈 잡이면 그 뱃지가 사람을 속인다. 아는 것만 적는다 — 폴러는 심박 판정이
 * 있고, 잡은 최근 실행 기록이 있다.
 *
 * 색은 표준 STATUS_RING 과 같은 토큰을 쓴다(bg-sage / bg-vermilion / bg-muted).
 */
export type AgentStatus = { label: string; ring: string };

export function agentStatus(input: {
  planned?: boolean;
  /** 회사 PC 폴러 심박 판정. 잡에는 없다. */
  verdict?: string;
  /** 최근 실행 시각. 없으면 최근 기간에 안 돌았다는 뜻. */
  lastAt?: string | null;
}): AgentStatus {
  // 멈춤이 가장 급하다 — 다른 조건보다 먼저 본다.
  if (input.verdict === "stopped") return { label: "멈춤", ring: "bg-vermilion" };
  if (input.planned) return { label: "예정", ring: "bg-muted" };
  if (input.verdict) return { label: "처리 중", ring: "bg-sage" };
  if (input.lastAt) return { label: "가동", ring: "bg-sage" };
  return { label: "기록 없음", ring: "bg-muted" };
}
