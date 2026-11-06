import "server-only";
import { QUEUED_MARK } from "@/features/automations/run-log-kind";
import {
  enqueueStatusRefresh,
  STATUS_REFRESH_AUTOMATION_REQUESTER,
} from "@/features/sms-sender/status-refresh/enqueue";
import type { AutomationRunResult } from "../types";

/**
 * AutomationJob.run — SMS 현황 최신화 요청 (회사 PC 폴러 큐 적재).
 *
 * Moa 수집(Cloudflare·SMS 2FA)과 현황 파일 저장(Excel COM)이 회사 PC 에서만 되므로,
 * 이 잡은 sms_status_refresh_requests 에 pending 1건을 넣기만 한다. 결과는 폴러가
 * /api/sms-status-refresh/request 로 보고하며 그때 따로 실행 기록이 남는다.
 *
 * **적재에 성공하면 접수 표식을 붙인다** — 적재가 `성공` 으로 찍히면 실제로 죽은 실행이
 * 성공으로 보인다(경쟁률 점검에서 겪었다). 적재 문구는 화면 버튼도 쓰므로 여기서만 붙인다.
 */
export async function runSmsStatusRefresh(): Promise<AutomationRunResult> {
  const result = await enqueueStatusRefresh(
    STATUS_REFRESH_AUTOMATION_REQUESTER,
  );
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, message: `${QUEUED_MARK} ${result.message}` };
}
