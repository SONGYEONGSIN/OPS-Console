import "server-only";
import { sendRequest } from "@/features/ops-weekly/notify/run";
import { toRunResult } from "@/features/ops-weekly/notify/run-result";
import type { AutomationRunResult } from "../types";

/** 수 10:00 — 이번 주 주간업무보고 작성 요청(작성자 전원 메일 + 운영부 그룹채팅). */
export async function runOpsWeeklyRequest(): Promise<AutomationRunResult> {
  return toRunResult("작성 요청", await sendRequest(new Date()));
}
