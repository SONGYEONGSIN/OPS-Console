import "server-only";
import { QUEUED_MARK } from "@/features/automations/run-log-kind";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 판정 요청 적재 — 서버 잡이 부르고 회사 PC 폴러가 가져간다(설계 §6.4).
 *
 * 판정이 Agent SDK 이고 서버에는 LLM 호출 경로가 없다(§4). 그래서 서버는 **요청만
 * 적재**한다. PC 가 꺼져 있어도 적재는 계속되므로 PC 중단이 '조용한 무동작' 이
 * 아니라 **pending 적체**로 드러난다.
 *
 * 권한 검사는 부르는 쪽 책임이다 — server action 은 `requireAdmin`,
 * cron route 는 `CRON_SECRET`(경쟁률 큐와 같다).
 */

/** 자동화(cron) 경로에는 세션이 없다. `requested_by` 가 not null 이라 값이 필요하다. */
export const AUTOMATION_REQUESTER = "automation";

/**
 * claim 후 이 시간이 지나도 완료 보고가 없는 `running` 은 죽은 것으로 본다.
 *
 * **폴러의 실행 제한보다 커야 한다.** 짧으면 정상 실행 중인 것을 죽었다고 보고
 * 같은 판정을 두 벌 만든다. 폴러의 판정 제한은 10분이다
 * (`scripts/assignments/propose-local.mjs` 의 `JUDGE_TIMEOUT_MS`) — **두 값은 묶여
 * 있어서** 한쪽을 늘리면 다른 쪽도 늘려야 한다.
 *
 * 이 안전장치가 필요한 이유는 겪어 본 사고다: `closing_scrape_requests` 에서 폴러가
 * claim 만 하고 죽어 `running` 이 2주간 큐를 막았다(2026-06-26).
 */
export const STALE_RUNNING_MS = 30 * 60_000;

export type ProposeRequestTarget =
  | { academicYear: number; kind: "annual" }
  | {
      academicYear: number;
      kind: "single";
      universityName: string;
      workKind: string;
    };

export type EnqueueProposeResult = {
  ok: boolean;
  /**
   * '안 해도 되는 날' 이다 — 이미 같은 판정이 대기 중이라 적재하지 않았다.
   * `AutomationRunResult.skipped` 로 그대로 넘어가 실패 집계에 안 들어간다.
   * **진짜 실패를 여기로 보내면 연간 생성이 안 돼도 아무도 모른다.**
   */
  skipped: boolean;
  message: string;
};

type BlockingRow = {
  id: string;
  status: "pending" | "running";
  claimed_at: string | null;
};

/** 폴러가 claim 한 뒤 죽어버린 요청인가 — `claimed_at` 기준. */
function isStaleRunning(row: BlockingRow, now: Date): boolean {
  if (row.status !== "running" || !row.claimed_at) return false;
  const claimedMs = new Date(row.claimed_at).getTime();
  if (Number.isNaN(claimedMs)) return false;
  return now.getTime() - claimedMs > STALE_RUNNING_MS;
}

const TABLE = "assignment_propose_requests";

/**
 * **같은 요청이 두 벌 쌓이는 것만 막는다.**
 *
 * 경쟁률 점검은 종류 무관 전역 1건인데, 그건 두 점검이 모두 Moa 로그인을 타서
 * 겹치면 세션이 충돌하기 때문이다. 판정은 Moa 를 타지 않는다. 여기서 전역 잠금을
 * 쓰면 **미배정 감지가 조용히 죽는다** — 평일마다 도는 잡이 pending 하나 때문에
 * 아무것도 적재하지 못하고, 두 번째 무주공산 서비스는 영영 판정되지 않는다.
 * 막아야 하는 것은 같은 판정의 중복뿐이다(§6.4 의 취지).
 */
export async function enqueueProposeRequest(
  requestedBy: string,
  target: ProposeRequestTarget,
  now: Date = new Date(),
): Promise<EnqueueProposeResult> {
  const admin = createAdminClient();
  const isSingle = target.kind === "single";

  let blockingQuery = admin
    .from(TABLE)
    .select("id, status, claimed_at")
    .eq("academic_year", target.academicYear)
    .eq("kind", target.kind)
    .in("status", ["pending", "running"]);
  if (isSingle) {
    blockingQuery = blockingQuery
      .eq("university_name", target.universityName)
      .eq("work_kind", target.workKind);
  }
  const { data: existing, error: selErr } = await blockingQuery.limit(1);
  if (selErr) {
    return { ok: false, skipped: false, message: selErr.message };
  }

  const blocking = (existing ?? [])[0] as BlockingRow | undefined;
  if (blocking) {
    if (!isStaleRunning(blocking, now)) {
      return {
        ok: false,
        skipped: true,
        message: "이미 대기/진행 중인 판정 요청이 있습니다.",
      };
    }

    // 여전히 running 일 때만 마감한다 — 폴러가 방금 완료 보고했을 수 있다(경합 방지).
    const { error: updErr } = await admin
      .from(TABLE)
      .update({
        status: "failed",
        finished_at: now.toISOString(),
        message: `폴러 claim 후 ${STALE_RUNNING_MS / 60_000}분 이상 미응답 — 자동 마감`,
      })
      .eq("id", blocking.id)
      .eq("status", "running");
    if (updErr) {
      return { ok: false, skipped: false, message: updErr.message };
    }
  }

  const { error } = await admin.from(TABLE).insert({
    requested_by: requestedBy,
    academic_year: target.academicYear,
    kind: target.kind,
    // annual 은 대상 칸을 비운다 — check 제약이 값이 든 annual 을 거부한다.
    university_name: isSingle ? target.universityName : null,
    work_kind: isSingle ? target.workKind : null,
    status: "pending",
  });
  if (error) {
    return { ok: false, skipped: false, message: error.message };
  }

  return {
    ok: true,
    skipped: false,
    // **접수 표식을 붙인다.** 이 줄이 `성공` 으로 찍혀 있어서 실제로 죽은 실행이
    // 성공으로 보인 적이 있다(2026-08-03·08-28). 결과는 폴러가 끝나며 따로 남긴다.
    message: `${QUEUED_MARK} 회사 PC 폴러에 판정을 요청했습니다. 결과는 끝나면 따로 남습니다.`,
  };
}
