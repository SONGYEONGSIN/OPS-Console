import "server-only";
import {
  enqueueLocalScrapeRequest,
  AUTOMATION_REQUESTER,
} from "@/features/closing/scrape-requests/enqueue";
import type { AutomationRunResult } from "../types";

/**
 * AutomationJob.run — Moa 서비스마감 스크래핑 요청 (로컬 폴러 큐 적재).
 *
 * GitHub Actions 러너는 데이터센터 IP라 Moa의 Cloudflare 챌린지를 통과하지 못한다
 * (2026-06-08 이후 6회 연속 '로그인 폼 미등장' 실패). 실제 스크랩은 회사 PC의
 * 폴러(poll-local.ps1)가 수행하므로, 본 잡은 closing_scrape_requests에 pending
 * 1건을 적재하기만 한다. 폴러가 5분 내 claim해 run-local을 실행하고,
 * 결과는 스크래퍼가 /api/closing/run-log로 보고한다.
 *
 * 격주 게이트·로그인·SMS 2FA·엑셀 파싱·인제스트 POST는 모두 스크래퍼가 담당한다.
 *
 * 트리거 경로: cron-job.org → /api/automations/run?jobId=closing-scrape → run().
 * 자동화 카드의 수동 실행도 같은 run()을 타므로 자동/수동이 동일 경로다.
 */
export async function runClosingScrape(): Promise<AutomationRunResult> {
  const result = await enqueueLocalScrapeRequest(AUTOMATION_REQUESTER);
  return { ok: result.ok, message: result.message };
}
