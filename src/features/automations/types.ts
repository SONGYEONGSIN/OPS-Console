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
};
