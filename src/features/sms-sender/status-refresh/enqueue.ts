import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type EnqueueResult = { ok: boolean; message: string };

const TABLE = "sms_status_refresh_requests";

/** 자동화(수동 실행) 경로에는 세션이 없다. requested_by 가 not null 이라 값이 필요하다. */
export const STATUS_REFRESH_AUTOMATION_REQUESTER = "automation";

/**
 * claim 후 이 시간이 지나도 완료 보고가 없는 running 은 죽은 것으로 본다.
 *
 * **폴러의 실행 제한(작업 스케줄러 30분)보다 커야 한다.** 짧으면 정상 실행 중인 것을
 * 죽었다고 보고 새 요청을 받아 둘이 겹쳐 돈다 — Moa 로그인을 타므로 겹치면 안 된다.
 * 실행 제한을 늘리면 이 값도 같이 늘려야 한다(두 값은 테스트로 묶는다).
 */
export const STALE_RUNNING_MS = 40 * 60_000;

const BUSY_MESSAGE =
  "이미 대기/진행 중인 최신화가 있습니다. 끝나면 다시 누르세요.";

const QUEUED_MESSAGE =
  "회사 PC 에 요청했습니다. 5분 안에 시작하고 약 10분 뒤 '최신화 이력'에 결과가 남습니다. Moa 인증 문자가 1통 갑니다.";

/** 부분 유니크 인덱스 위반 — 두 사람이 거의 동시에 눌렀다. */
const UNIQUE_VIOLATION = "23505";

type BlockingRow = {
  id: string;
  status: "pending" | "running";
  claimed_at: string | null;
};

/**
 * DB 오류는 고정 문구로만 보인다 — 원문에는 값이 섞일 수 있다(예: 유니크 위반의 Key 값).
 * 서버 로그에도 어느 단계에서 났는지와 오류 코드만 남긴다.
 */
const FAILED_MESSAGE =
  "최신화 요청을 처리하지 못했습니다. 잠시 뒤 다시 시도하세요.";

function failed(stage: string, error: { code?: string }): EnqueueResult {
  console.error(
    `[sms-status-refresh] enqueue ${stage} fail`,
    error.code ?? "no-code",
  );
  return { ok: false, message: FAILED_MESSAGE };
}

/**
 * 폴러가 claim 한 뒤 죽어버린 요청인가 — claimed_at 기준.
 * 화면(history.ts)도 같은 판정으로 죽은 running 을 '진행 중'에서 뺀다 — 안 빼면 버튼이
 * 잠긴 채라 마감(이 파일의 적재 경로)에 영영 닿지 못한다.
 */
export function isStaleRunning(
  row: Pick<BlockingRow, "claimed_at"> & { status: string },
  now: Date,
): boolean {
  if (row.status !== "running" || !row.claimed_at) return false;
  const claimedMs = new Date(row.claimed_at).getTime();
  if (Number.isNaN(claimedMs)) return false;
  return now.getTime() - claimedMs > STALE_RUNNING_MS;
}

/**
 * 현황 최신화 요청 1건 적재. 회사 PC 폴러가 5분마다 pending 을 claim 한다.
 * 권한 검사는 호출자 책임 — server action 은 담당자/admin 재확인, 자동화 잡은 admin 실행.
 *
 * 활성(pending/running) 요청은 1건 — 이 조회와 DB 부분 유니크 인덱스 두 겹이다.
 * 조회를 둘이 동시에 통과하면 두 번째 insert 가 23505 로 막히고, 그것도 진행 중 안내로 보인다.
 *
 * @param now stale 판정 기준 시각 (테스트 결정성을 위해 주입)
 */
export async function enqueueStatusRefresh(
  requestedBy: string,
  now: Date = new Date(),
): Promise<EnqueueResult> {
  const admin = createAdminClient();

  const { data: existing, error: selErr } = await admin
    .from(TABLE)
    .select("id, status, claimed_at")
    .in("status", ["pending", "running"])
    .limit(1);
  if (selErr) return failed("select", selErr);

  const blocking = (existing ?? [])[0] as BlockingRow | undefined;
  if (blocking) {
    if (!isStaleRunning(blocking, now)) {
      return { ok: false, message: BUSY_MESSAGE };
    }
    // 여전히 running 일 때만 마감 — 폴러가 방금 완료 보고했을 수 있다(경합 방지)
    const { error: updErr } = await admin
      .from(TABLE)
      .update({
        status: "failed",
        finished_at: now.toISOString(),
        message: `폴러 claim 후 ${STALE_RUNNING_MS / 60_000}분 이상 미응답 — 자동 마감`,
      })
      .eq("id", blocking.id)
      .eq("status", "running");
    if (updErr) return failed("stale-close", updErr);
  }

  const { error } = await admin
    .from(TABLE)
    .insert({ requested_by: requestedBy, status: "pending" });
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { ok: false, message: BUSY_MESSAGE };
    }
    return failed("insert", error);
  }

  return { ok: true, message: QUEUED_MESSAGE };
}
