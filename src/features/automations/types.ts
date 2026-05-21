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

export type AutomationStatus = {
  id: string;
  label: string;
  description: string;
  scheduleInfo: string;
  cooldownMinutes: number;
  lastRunAt: string | null;
  cooldownRemainingMinutes: number;
};
