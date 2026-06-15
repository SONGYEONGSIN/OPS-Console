import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** 자동화 1회 실행의 결과(실행/스킵/실패 공통). */
export type RunOutcome = {
  ok: boolean;
  /** 자동 실행 OFF로 cron이 스킵한 호출이면 true. */
  skipped?: boolean;
  message: string;
  durationMs?: number;
};

export type AutomationRunRow = {
  job_id: string;
  ok: boolean;
  skipped: boolean;
  message: string;
  duration_ms: number | null;
};

const MESSAGE_MAX = 1000;

/** 실행 결과 → automation_runs insert 행. (순수) */
export function buildRunRow(
  jobId: string,
  outcome: RunOutcome,
): AutomationRunRow {
  return {
    job_id: jobId,
    ok: outcome.ok,
    skipped: outcome.skipped ?? false,
    message: outcome.message.slice(0, MESSAGE_MAX),
    duration_ms: outcome.durationMs ?? null,
  };
}

/**
 * 자동화 실행 1건을 automation_runs에 기록한다.
 * 관측용 로깅이므로 best-effort — 적재 실패가 잡 실행 결과/응답을 깨지 않도록 삼킨다.
 */
export async function recordAutomationRun(
  jobId: string,
  outcome: RunOutcome,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("automation_runs").insert(buildRunRow(jobId, outcome));
  } catch {
    // 로깅 실패는 무시 — 잡 자체는 이미 실행됐고, 적재 실패로 실행을 깨면 안 된다.
  }
}
