import "server-only";
import {
  enqueueLocalAuditRequest,
  AUTOMATION_REQUESTER,
} from "@/features/ratio-audit/audit-requests/enqueue";
import type { AutomationRunResult } from "../types";

/**
 * AutomationJob.run — 경쟁률 페이지 점검 요청 (로컬 폴러 큐 적재).
 *
 * 세팅 점검(runRatioAudit)과 같은 큐를 쓰되 kind=page로 적재한다. 폴러가 이 값을 보고
 * REAL 서버 목록 → 경쟁률 HTML 링크 상태만 확인한다(TEST 서버 상세 순회·claude 판정 없음).
 *
 * 링크 확인만 하면 되는데도 Moa 로그인이 필요하다 — REAL 목록 자체가 로그인 뒤에만
 * 나온다. 그래서 세팅 점검과 동시에 돌릴 수 없고(세션 충돌), 큐도 하나만 쓴다.
 */
export async function runRatioPageCheck(): Promise<AutomationRunResult> {
  const result = await enqueueLocalAuditRequest(
    AUTOMATION_REQUESTER,
    new Date(),
    "page",
  );
  return { ok: result.ok, message: result.message };
}
