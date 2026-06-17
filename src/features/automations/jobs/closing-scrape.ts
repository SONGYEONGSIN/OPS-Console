import "server-only";
import { dispatchWorkflow } from "@/lib/github/dispatch-workflow";
import type { AutomationRunResult } from "../types";

/**
 * AutomationJob.run — Moa 서비스마감 스크래핑 트리거 (순수 디스패처).
 *
 * SmileEDI(워크플로→OPS 메일 잡)와 반대 방향. 본 잡은 GitHub `workflow_dispatch`로
 * `moa-closing-scrape.yml`을 1회 깨우기만 한다. 격주 게이트·로그인·SMS 2FA·엑셀 파싱·
 * 마감 필터·인제스트 POST는 모두 워크플로(Python 스크래퍼)가 담당한다.
 *
 * 트리거 경로: cron-job.org 매주 월 → /api/automations/run?jobId=closing-scrape → run().
 * 실행 주기(주간/격주)는 스크래퍼가 판정(off주 exit 0)하므로 본 잡은 매번 dispatch한다. 현재 주간.
 *
 * 환경변수: dispatchWorkflow가 GITHUB_DISPATCH_TOKEN/REPO/WORKFLOW 검증(누락 시 ok:false).
 */
export async function runClosingScrape(): Promise<AutomationRunResult> {
  const result = await dispatchWorkflow();
  if (!result.ok) {
    return { ok: false, message: `GitHub 워크플로 트리거 실패 — ${result.error}` };
  }
  return {
    ok: true,
    message:
      "Moa 서비스마감 스크래핑 워크플로를 트리거했습니다. (실행 주기는 워크플로가 판정)",
  };
}
