import "server-only";
import {
  enqueueLocalAuditRequest,
  AUTOMATION_REQUESTER,
} from "@/features/ratio-audit/audit-requests/enqueue";
import type { AutomationRunResult } from "../types";

/**
 * AutomationJob.run — 경쟁률 세팅 점검 요청 (로컬 폴러 큐 적재).
 *
 * audit.py는 Selenium(브라우저) + Moa 로그인 + 로컬 claude -p 판정이 필요해 Vercel
 * 서버에서 실행할 수 없다 — closing-scrape와 동일한 제약이다. 실제 점검은 회사 PC의
 * 폴러(poll-local.ps1)가 수행하므로, 본 잡은 ratio_audit_requests에 pending 1건을
 * 적재하기만 한다. 폴러가 5분 내 claim해 audit.py를 실행하고, 결과는 스크립트가
 * /api/ratio-audit/ingest로 보고한다.
 *
 * cron 미등록 — 이 잡은 자동화 페이지의 수동 실행 전용이다. 판정 정확도가 안정되기
 * 전까지는 사람이 버튼을 눌러 트리거한다(design §14).
 */
export async function runRatioAudit(): Promise<AutomationRunResult> {
  const result = await enqueueLocalAuditRequest(AUTOMATION_REQUESTER);
  return { ok: result.ok, message: result.message };
}
