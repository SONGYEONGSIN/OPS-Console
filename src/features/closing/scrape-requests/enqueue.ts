import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type EnqueueResult = { ok: boolean; message: string };

/** 자동화(cron) 경로에는 세션이 없다. requested_by가 not null이라 값이 필요하다. */
export const AUTOMATION_REQUESTER = "automation";

/**
 * claim 후 이 시간이 지나도 완료 보고가 없는 running은 죽은 것으로 본다.
 * 폴러의 실행 제한이 20분(register-poll-task.ps1의 ExecutionTimeLimit)이라 여유를 뒀다.
 */
export const STALE_RUNNING_MS = 30 * 60_000;

type BlockingRow = {
  id: string;
  status: "pending" | "running";
  claimed_at: string | null;
};

/** 폴러가 claim한 뒤 죽어버린 요청인가 — claimed_at 기준. */
function isStaleRunning(row: BlockingRow, now: Date): boolean {
  if (row.status !== "running" || !row.claimed_at) return false;
  const claimedMs = new Date(row.claimed_at).getTime();
  if (Number.isNaN(claimedMs)) return false;
  return now.getTime() - claimedMs > STALE_RUNNING_MS;
}

/**
 * 서비스 마감 스크랩 '로컬 실행 요청' 1건 적재.
 *
 * 회사 PC 폴러(poll-local.ps1)가 5분마다 pending을 claim해 run-local을 실행한다.
 * 자동화 잡(cron)과 admin 수동 실행이 같은 경로를 쓰도록 세션 의존 없이 분리했다.
 * 권한 검사는 호출자 책임 — server action은 requireAdmin, cron route는 CRON_SECRET.
 *
 * 이미 pending/running 요청이 있으면 적재하지 않는다. 폴러가 죽어 있을 때
 * cron이 매주 요청을 쌓는 것을 막는다.
 *
 * 단, 폴러가 claim만 하고 죽으면(PC 종료 등) running이 영원히 남아 큐가 잠긴다
 * (실제로 2026-06-26 요청이 2주간 큐를 막았다). STALE_RUNNING_MS를 넘긴 running은
 * failed로 마감하고 새 요청을 받는다.
 *
 * @param now stale 판정 기준 시각 (테스트 결정성을 위해 주입)
 */
export async function enqueueLocalScrapeRequest(
  requestedBy: string,
  now: Date = new Date(),
): Promise<EnqueueResult> {
  const admin = createAdminClient();

  const { data: existing, error: selErr } = await admin
    .from("closing_scrape_requests")
    .select("id, status, claimed_at")
    .in("status", ["pending", "running"])
    .limit(1);
  if (selErr) return { ok: false, message: selErr.message };

  const blocking = (existing ?? [])[0] as BlockingRow | undefined;
  if (blocking) {
    if (!isStaleRunning(blocking, now)) {
      return {
        ok: false,
        message:
          "이미 대기/진행 중인 요청이 있습니다. 회사 PC 폴러 처리를 기다려 주세요.",
      };
    }

    // 여전히 running일 때만 마감 — 폴러가 방금 완료 보고했을 수 있다(경합 방지)
    const { error: updErr } = await admin
      .from("closing_scrape_requests")
      .update({
        status: "failed",
        finished_at: now.toISOString(),
        message: `폴러 claim 후 ${STALE_RUNNING_MS / 60_000}분 이상 미응답 — 자동 마감`,
      })
      .eq("id", blocking.id)
      .eq("status", "running");
    if (updErr) return { ok: false, message: updErr.message };
  }

  const { error } = await admin
    .from("closing_scrape_requests")
    .insert({ requested_by: requestedBy, status: "pending" });
  if (error) return { ok: false, message: error.message };

  return {
    ok: true,
    message:
      "로컬 실행을 요청했습니다. 회사 PC 폴러가 곧 실행합니다(최대 5분).",
  };
}
