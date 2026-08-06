import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getJob } from "./registry";
import { getAutomationRunLog } from "./run-logs";
import { shouldNotifyFailure, renderFailureHtml } from "./failure-notify";
import { sendAutomationReport } from "./report-send";

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
 *
 * 기록 직후 실패 알림 판정을 붙인다. 적재와 같은 자리에 두는 이유는 여기가 실행 결과가
 * 모이는 단일 지점이기 때문 — cron route·수동 실행 액션·외부 잡 보고가 모두 이 함수를 지난다.
 */
export async function recordAutomationRun(
  jobId: string,
  outcome: RunOutcome,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("automation_runs").insert(buildRunRow(jobId, outcome));
    await notifyIfFirstFailure(jobId);
  } catch {
    // 로깅 실패는 무시 — 잡 자체는 이미 실행됐고, 적재 실패로 실행을 깨면 안 된다.
  }
}

/** 방금 기록한 실행이 '이번 장애의 첫 실패'일 때만 보고한다. */
async function notifyIfFirstFailure(jobId: string): Promise<void> {
  const recent = await getAutomationRunLog(jobId);
  if (!shouldNotifyFailure(recent)) return;
  const label = getJob(jobId)?.label ?? jobId;
  await sendAutomationReport(renderFailureHtml(label, recent[0]));
}
