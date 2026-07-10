import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type EnqueueResult = { ok: boolean; message: string };

/** 자동화(cron) 경로에는 세션이 없다. requested_by가 not null이라 값이 필요하다. */
export const AUTOMATION_REQUESTER = "automation";

/**
 * 서비스 마감 스크랩 '로컬 실행 요청' 1건 적재.
 *
 * 회사 PC 폴러(poll-local.ps1)가 5분마다 pending을 claim해 run-local을 실행한다.
 * 자동화 잡(cron)과 admin 수동 실행이 같은 경로를 쓰도록 세션 의존 없이 분리했다.
 * 권한 검사는 호출자 책임 — server action은 requireAdmin, cron route는 CRON_SECRET.
 *
 * 이미 pending/running 요청이 있으면 적재하지 않는다. 폴러가 죽어 있을 때
 * cron이 매주 요청을 쌓는 것을 막는다.
 */
export async function enqueueLocalScrapeRequest(
  requestedBy: string,
): Promise<EnqueueResult> {
  const admin = createAdminClient();

  const { data: existing, error: selErr } = await admin
    .from("closing_scrape_requests")
    .select("id")
    .in("status", ["pending", "running"])
    .limit(1);
  if (selErr) return { ok: false, message: selErr.message };
  if (existing && existing.length > 0) {
    return {
      ok: false,
      message:
        "이미 대기/진행 중인 요청이 있습니다. 회사 PC 폴러 처리를 기다려 주세요.",
    };
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
