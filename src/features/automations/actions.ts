"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/features/auth/permission";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listRatioAuditTargets,
  type RatioAuditTarget,
} from "@/features/ratio-audit/queries";
import {
  enqueueLocalAuditRequest,
  AUTOMATION_REQUESTER,
} from "@/features/ratio-audit/audit-requests/enqueue";
import {
  conditionLine,
  ratioFilterLabel,
  type RatioAuditFilters,
} from "@/features/ratio-audit/run-filters";
import {
  ratioKindOfJob,
  type RatioAuditJobId,
} from "@/features/ratio-audit/run-message";
import {
  runAutomationInputSchema,
  runRatioAuditInputSchema,
  setAutomationEnabledInputSchema,
  publishBriefingDraftInputSchema,
} from "./schemas";
import { publishStagedDraft } from "./jobs/team-briefing";
import { getJob } from "./registry";
import {
  computeCooldownRemaining,
  getJobLastRunAt,
  getJobEnabled,
} from "./queries";
import { getJobRunLog, getAutomationRunLog } from "./run-logs";
import { recordAutomationRun } from "./run-recorder";
import type { JobRunLog } from "./run-logs-normalize";
import type {
  AutomationJob,
  AutomationRunResult,
  AutomationRunEntry,
} from "./types";

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

// 수동 실행을 막는 사유 — localOnly·자동 실행(enabled)·쿨다운. 막을 게 없으면 null.
// 일반 실행과 경쟁률 조건 실행이 같은 판정을 쓴다.
async function runBlocker(
  job: AutomationJob,
  force: boolean,
): Promise<RunActionState | null> {
  if (job.localOnly) {
    return {
      ok: false,
      message:
        "로컬 전용 자동화입니다. Mac mini의 로컬 cron(claude CLI)에서 실행되며, 여기서는 실행할 수 없습니다.",
    };
  }

  if (await getJobEnabled(job.id)) {
    return {
      ok: false,
      message:
        "자동 실행 중에는 수동 실행할 수 없습니다. 자동 실행을 끄고 다시 시도하세요.",
    };
  }

  if (!force) {
    const lastRunAt = await getJobLastRunAt(job.id);
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

  return null;
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

  const blocked = await runBlocker(job, force);
  if (blocked) return blocked;

  const startedMs = Date.now();
  const result = await job.run();
  await recordAutomationRun(jobId, {
    ok: result.ok,
    message: result.message,
    skipped: result.skipped,
    durationMs: Date.now() - startedMs,
  });
  revalidatePath("/dashboard/automations");
  revalidatePath("/dashboard/ai-insight");
  return result;
}

// 대상 조회 → 0건이면 요청 안 함 → 조건을 실어 적재·기록 (순서 고정)
async function queueRatioAudit(
  jobId: RatioAuditJobId,
  filters: RatioAuditFilters,
): Promise<AutomationRunResult> {
  const startedMs = Date.now();
  // 접수 줄의 건수는 이 시각 기준이다. 폴러는 대상을 받는 시점(new Date())에 다시 세므로
  // 폴러 결과의 건수는 접수 줄과 다를 수 있다 — now 는 적재의 stale 판정에도 쓰인다
  const now = new Date();

  let targets: RatioAuditTarget[];
  try {
    targets = await listRatioAuditTargets(filters, now);
  } catch {
    return {
      ok: false,
      message: "점검 대상을 읽지 못했습니다. 잠시 뒤 다시 시도하세요.",
    };
  }
  if (targets.length === 0) {
    return {
      ok: false,
      message: `조건에 맞는 점검 대상이 없어 요청하지 않았습니다 — ${ratioFilterLabel(filters)}`,
    };
  }

  const r = await enqueueLocalAuditRequest(
    AUTOMATION_REQUESTER,
    now,
    ratioKindOfJob(jobId),
    filters,
  );
  // 큐 점유 거절은 실패가 아니다 — 기록하면 실패 알림 오발과 직전 실패 억제가 걸린다
  if (r.busy) return { ok: false, message: r.message };
  // 접두(QUEUED_MARK)가 맨 앞에 있어야 하므로 조건 줄은 끝에 붙인다
  const message = r.ok
    ? `${r.message} ${conditionLine(filters, targets.length)}`
    : r.message;
  await recordAutomationRun(jobId, {
    ok: r.ok,
    message,
    durationMs: Date.now() - startedMs,
  });
  revalidatePath("/dashboard/automations");
  return { ok: r.ok, message };
}

/**
 * 경쟁률 점검 조건 실행 — 조건 창의 [실행]. admin 전용.
 * 조건 없이 적재하는 길은 닫혀 있고(run() 은 거절), 여기서만 조건을 실어 적재한다.
 */
export async function runRatioAuditAction(
  _prev: RunActionState,
  formData: FormData,
): Promise<RunActionState> {
  await requireAdmin();

  const parsed = runRatioAuditInputSchema.safeParse({
    jobId: formData.get("jobId"),
    force: formData.get("force") === "1",
    univ: formData.getAll("univ"),
    recruit: formData.getAll("recruit"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const { jobId, force, univ, recruit } = parsed.data;
  const job = getJob(jobId);
  if (!job) {
    return { ok: false, message: `알 수 없는 자동화: ${jobId}` };
  }

  const blocked = await runBlocker(job, force);
  if (blocked) return blocked;

  return queueRatioAudit(jobId, { univ, recruit });
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

/**
 * 초안 발행 확정 — 자동화 페이지 [발행] 버튼. admin 전용.
 * 사람이 미리보기로 내용을 확인한 뒤에만 그룹채팅 티저가 나간다.
 * 실행 이력 메시지에 뉴스레터 링크를 남겨 로그에서 바로 열 수 있게 한다.
 */
export async function publishBriefingDraftAction(
  _prev: RunActionState,
  formData: FormData,
): Promise<RunActionState> {
  await requireAdmin();

  const parsed = publishBriefingDraftInputSchema.safeParse({
    draftId: formData.get("draftId"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const startedMs = Date.now();
  const r = await publishStagedDraft(parsed.data.draftId);
  const message = r.ok
    ? `#${r.issueNo}호 발행 (Teams ${r.sent ? "발송" : "생략"}) — ${r.url}`
    : r.message;
  await recordAutomationRun("team-briefing", {
    ok: r.ok,
    skipped: false,
    message,
    durationMs: Date.now() - startedMs,
  });
  revalidatePath("/dashboard/automations");
  return { ok: r.ok, message };
}
