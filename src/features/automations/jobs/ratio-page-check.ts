import "server-only";
import { RATIO_RUN_NEEDS_CONDITIONS } from "@/features/ratio-audit/run-filters";
import type { AutomationRunResult } from "../types";

/**
 * AutomationJob.run — 경쟁률 페이지 점검 (REAL 서버).
 *
 * 조건 없는 요청을 만들지 않는다 — 일반 실행 액션·cron route 가 이 함수를 부른다.
 * 실행은 조건 창(runRatioAuditAction)에서만 한다.
 *
 * cron 미등록 — 수동 실행 전용이며, 링크 상태 확인은 회사 PC 폴러가 kind=page 로 맡는다.
 */
export async function runRatioPageCheck(): Promise<AutomationRunResult> {
  // ok:false 는 route 의 상태 코드용, skipped 는 '일부러 안 돌았다'라 실패 알림·보고에서 뺀다.
  return { ok: false, skipped: true, message: RATIO_RUN_NEEDS_CONDITIONS };
}
