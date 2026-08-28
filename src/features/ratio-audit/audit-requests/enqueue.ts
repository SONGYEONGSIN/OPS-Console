import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RatioAuditKind } from "../schemas";

export type EnqueueResult = { ok: boolean; message: string };

/** 자동화(cron) 경로에는 세션이 없다. requested_by가 not null이라 값이 필요하다. */
export const AUTOMATION_REQUESTER = "automation";

/**
 * claim 후 이 시간이 지나도 완료 보고가 없는 running은 죽은 것으로 본다.
 *
 * **폴러의 실행 제한보다 커야 한다.** 짧으면 정상 실행 중인 것을 죽었다고 보고 새
 * 요청을 받아 둘이 겹쳐 돈다 — Moa 로그인을 타므로 동시 실행은 막아야 한다.
 * 실행 제한은 1시간이다(`scripts/lib/ensure-poller-restart.ps1`). 정상 소요는 17분.
 *
 * 20분 제한이던 때 그 경계에 걸려 강제 종료된 적이 있다(2026-08-28). 제한을 늘리면
 * **이 값도 같이 늘려야 한다** — 두 값은 묶여 있다.
 *
 * closing_scrape_requests에서 실제로 겪은 사고(2026-06-26, 폴러가 claim만 하고 죽어
 * running이 2주간 큐를 막음)와 동일한 위험을 이 큐도 그대로 안고 있다 — 회사 PC가
 * 꺼지거나 audit.py가 크래시하면 완료 보고가 영영 오지 않는다. 그래서 같은 안전장치를
 * 여기도 그대로 둔다.
 */
export const STALE_RUNNING_MS = 70 * 60_000;

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
 * 경쟁률 세팅 점검 '로컬 실행 요청' 1건 적재.
 *
 * 회사 PC 폴러(poll-local.ps1)가 5분마다 pending을 claim해 audit.py를 실행한다.
 * 자동화 잡(cron)과 admin 수동 실행이 같은 경로를 쓰도록 세션 의존 없이 분리했다.
 * 권한 검사는 호출자 책임 — server action은 requireAdmin, cron route는 CRON_SECRET.
 *
 * 이미 pending/running 요청이 있으면 적재하지 않는다. 폴러가 죽어 있을 때
 * cron이 매주 요청을 쌓는 것을 막는다.
 *
 * 단, 폴러가 claim만 하고 죽으면(PC 종료 등) running이 영원히 남아 큐가 잠긴다
 * (closing_scrape_requests에서 실제로 2주간 큐를 막은 사고가 있었다). STALE_RUNNING_MS를
 * 넘긴 running은 failed로 마감하고 새 요청을 받는다.
 *
 * 종류(kind)가 달라도 동시에 실행하지 않는다 — 스케줄 점검과 페이지 점검 모두 Moa
 * 로그인을 타므로 겹치면 세션이 충돌한다.
 *
 * @param now stale 판정 기준 시각 (테스트 결정성을 위해 주입)
 * @param kind 점검 종류 — schedule(세팅·문구) / page(HTML 링크 상태)
 */
export async function enqueueLocalAuditRequest(
  requestedBy: string,
  now: Date = new Date(),
  kind: RatioAuditKind = "schedule",
): Promise<EnqueueResult> {
  const admin = createAdminClient();

  const { data: existing, error: selErr } = await admin
    .from("ratio_audit_requests")
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
          "이미 대기/진행 중인 점검이 있습니다. 회사 PC 폴러 처리를 기다려 주세요.",
      };
    }

    // 여전히 running일 때만 마감 — 폴러가 방금 완료 보고했을 수 있다(경합 방지)
    const { error: updErr } = await admin
      .from("ratio_audit_requests")
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
    .from("ratio_audit_requests")
    .insert({ requested_by: requestedBy, status: "pending", kind });
  if (error) return { ok: false, message: error.message };

  return {
    ok: true,
    message:
      "로컬 실행을 요청했습니다. 회사 PC 폴러가 곧 실행합니다(최대 5분).",
  };
}
