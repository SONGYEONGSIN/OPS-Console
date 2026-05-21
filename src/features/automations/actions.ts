"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/features/auth/permission";
import { runAutomationInputSchema } from "./schemas";
import { getJob } from "./registry";
import { computeCooldownRemaining, getJobLastRunAt } from "./queries";
import type { AutomationRunResult } from "./types";

export type RunActionState = AutomationRunResult | undefined;

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

  const result = await job.run();
  revalidatePath("/dashboard/automations");
  revalidatePath("/dashboard/ai-insight");
  return result;
}
