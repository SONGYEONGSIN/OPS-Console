"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/features/auth/permission";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  runAutomationInputSchema,
  setAutomationEnabledInputSchema,
} from "./schemas";
import { getJob } from "./registry";
import {
  computeCooldownRemaining,
  getJobLastRunAt,
  getJobEnabled,
} from "./queries";
import { getJobRunLog, getAutomationRunLog } from "./run-logs";
import { recordAutomationRun } from "./run-recorder";
import type { JobRunLog } from "./run-logs-normalize";
import type { AutomationRunResult, AutomationRunEntry } from "./types";

export type RunActionState = AutomationRunResult | undefined;

export type JobRunLogResult =
  | { ok: true; runs: AutomationRunEntry[]; log: JobRunLog }
  | { ok: false; message: string };

export async function getJobRunLogAction(
  jobId: string,
): Promise<JobRunLogResult> {
  await requireAdmin();
  if (!getJob(jobId)) {
    return { ok: false, message: `알 수 없는 자동화: ${jobId}` };
  }
  const [runs, log] = await Promise.all([
    getAutomationRunLog(jobId),
    getJobRunLog(jobId),
  ]);
  return { ok: true, runs, log };
}

export async function runAutomationAction(
  _prev: RunActionState,
  formData: FormData,
): Promise<RunActionState> {
  await requireAdmin();

  const parsed = runAutomationInputSchema.safeParse({
    jobId: formData.get("jobId"),
    force: formData.get("force") === "1",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const { jobId, force } = parsed.data;
  const job = getJob(jobId);
  if (!job) {
    return { ok: false, message: `알 수 없는 자동화: ${jobId}` };
  }

  if (job.localOnly) {
    return {
      ok: false,
      message:
        "로컬 전용 자동화입니다. Mac mini의 로컬 cron(claude CLI)에서 실행되며, 여기서는 실행할 수 없습니다.",
    };
  }

  if (await getJobEnabled(jobId)) {
    return {
      ok: false,
      message:
        "자동 실행 중에는 수동 실행할 수 없습니다. 자동 실행을 끄고 다시 시도하세요.",
    };
  }

  if (!force) {
    const lastRunAt = await getJobLastRunAt(jobId);
    const remaining = computeCooldownRemaining(
      lastRunAt,
      job.cooldownMinutes,
      new Date(),
    );
    if (remaining > 0) {
      return {
        ok: false,
        message: `최근 실행 후 ${remaining}분 남았습니다. 강제 실행하려면 다시 확인하세요.`,
        details: { cooldownRemaining: remaining },
      };
    }
  }

  const startedMs = Date.now();
  const result = await job.run();
  await recordAutomationRun(jobId, {
    ok: result.ok,
    message: result.message,
    durationMs: Date.now() - startedMs,
  });
  revalidatePath("/dashboard/automations");
  revalidatePath("/dashboard/ai-insight");
  return result;
}

export async function setAutomationEnabledAction(
  _prev: RunActionState,
  formData: FormData,
): Promise<RunActionState> {
  await requireAdmin();

  const rawEnabled = formData.get("enabled");
  const parsed = setAutomationEnabledInputSchema.safeParse({
    jobId: formData.get("jobId"),
    enabled: rawEnabled === null ? undefined : rawEnabled === "1",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const { jobId, enabled } = parsed.data;
  if (!getJob(jobId)) {
    return { ok: false, message: `알 수 없는 자동화: ${jobId}` };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("automation_settings")
    .upsert(
      { job_id: jobId, enabled, updated_at: new Date().toISOString() },
      { onConflict: "job_id" },
    );
  if (error) {
    return { ok: false, message: `설정 저장 실패: ${error.message}` };
  }

  revalidatePath("/dashboard/automations");
  return { ok: true, message: enabled ? "자동 실행 켜짐" : "자동 실행 꺼짐" };
}
