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
  /** 로컬 전용 잡 여부 — UI가 수동/자동 컨트롤 대신 '로컬 전용' 표시로 분기. */
  localOnly: boolean;
};
