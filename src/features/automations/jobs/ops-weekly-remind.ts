import "server-only";
import { sendRemind } from "@/features/ops-weekly/notify/run";
import { toRunResult } from "@/features/ops-weekly/notify/run-result";
import type { AutomationRunResult } from "../types";

/** 목 12:00·17:00 — 아직 안 낸 사람에게만. 같은 반나절에 두 번 불려도 한 번. */
export async function runOpsWeeklyRemind(): Promise<AutomationRunResult> {
  return toRunResult("미제출 알림", await sendRemind(new Date()));
}
