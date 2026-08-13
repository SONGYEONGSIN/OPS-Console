/**
 * 팀원의 출처 — 판별 유니온이라 "정확히 하나"가 컴파일 시점에 강제된다.
 *
 * 레지스트리가 자동 실행의 전부가 아니다(2026-08-13 확인). 실패 알림은 잡이 아니라
 * recordAutomationRun 직후 도는 상시 동작이고, 백업·자료 요청 예약 발송은
 * cron-job.org가 5분마다 때리는 별도 엔드포인트다. 이들을 "예정"으로 두면
 * 돌고 있는 것을 안 돈다고 표시하게 된다.
 */
export type AgentMemberSource =
  | { kind: "job"; jobId: string }
  | { kind: "outside"; path: string; note: string }
  | { kind: "planned" };

export type AgentMember = {
  /** 카드 좌측 라벨 — "마감", "입금" 처럼 짧게 */
  role: string;
  /** kebab-case 식별자 — 전 팀에서 유일해야 한다 */
  agent: string;
  /** LLM으로 판단하는 자리. 화면에 ✦ */
  llm?: boolean;
  source: AgentMemberSource;
};

export type AgentTeam = {
  id: string;
  name: string;
  leader: { name: string; tagline: string };
  /** 성향 칩 — 읽기 전용 라벨이라 호버·선택 인터랙션을 주지 않는다 */
  traits: string[];
  members: AgentMember[];
};
