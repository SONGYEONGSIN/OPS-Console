/**
 * 목록 한 줄이 아는 것. 화면 컴포넌트가 서버 타입을 직접 물지 않게 갈라 둔다.
 */
export type AgentRow = {
  agent: string;
  role: string;
  team: string;
  /** 맡은 일 한 줄. 잡 라벨 또는 폴러 라벨. */
  detail: string;
  llm: boolean;
  planned: boolean;
  /** 회사 PC 폴러면 그 id. 없으면 생사를 말하지 않는다. */
  pollerId?: string;
};
