export type AutomationRunResult = {
  ok: boolean;
  message: string;
  details?: Record<string, number>;
};

export type AutomationJob = {
  id: string;
  label: string;
  description: string;
  scheduleInfo: string;
  cooldownMinutes: number;
  run: () => Promise<AutomationRunResult>;
  /**
   * 로컬 전용 잡 — 서버리스(Vercel/cron route)로 실행 불가하고 외부 머신(예: Mac mini
   * 로컬 cron + claude CLI)에서만 동작한다. UI는 수동 실행·자동 토글을 숨기고 이력만 표시하며,
   * cron route·수동 실행 액션은 실행을 거부한다. 이력은 그 머신이 automation_runs에 직접 적재.
   */
  localOnly?: boolean;
  /**
   * 수동 전용 잡 — cron 스케줄이 없어 자동 실행 토글이 의미가 없다.
   *
   * 토글을 켜면 UI가 수동 실행 버튼을 감추는데(자동 실행 중 표시), 정작 호출할
   * cron이 없어 잡이 통째로 죽는다. 토글 자체를 없애 그 상태를 만들 수 없게 한다.
   */
  manualOnly?: boolean;
};

/** automation_runs 1행의 표시용 형태 — 실행 이력 패널/하이브리드 로그 공용. */
export type AutomationRunEntry = {
  ranAt: string;
  ok: boolean;
  skipped: boolean;
  message: string;
};

export type AutomationStatus = {
  id: string;
  label: string;
  description: string;
  scheduleInfo: string;
  cooldownMinutes: number;
  lastRunAt: string | null;
  cooldownRemainingMinutes: number;
  enabled: boolean;
  /** 발행 대기 중인 초안 (team-briefing 전용) — 없으면 undefined. */
  pendingDraft?: {
    id: string;
    issueNo: number;
    url: string;
    createdAt: string;
  };
  /** 로컬 전용 잡 여부 — UI가 수동/자동 컨트롤 대신 '로컬 전용' 표시로 분기. */
  localOnly: boolean;
  /** 수동 전용(cron 없음) 여부 — UI가 자동 실행 토글을 숨기고 실행 버튼만 남긴다. */
  manualOnly?: boolean;
};
