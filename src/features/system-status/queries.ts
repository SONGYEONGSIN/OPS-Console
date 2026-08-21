import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { POLLERS, type PollerDef } from "./pollers";
import { judgePoller, type Judgement, type PollerSample } from "./verdict";

export type PollerStatus = PollerDef & Judgement & { sample: PollerSample };

/**
 * 큐 한 개를 읽어 표본을 만든다.
 *
 * 대기·처리 중인 것만 오름차순으로 조금 읽는다 — 판정에 필요한 건 **가장 오래
 * 기다린 하나**와 건수뿐이다. 전체를 읽으면 큐가 큰 잡에서 느려진다.
 */
async function sampleQueue(table: string): Promise<PollerSample> {
  const admin = createAdminClient();

  const [live, recent] = await Promise.all([
    admin
      .from(table)
      .select("status, requested_at, claimed_at")
      .in("status", ["pending", "running"])
      .order("requested_at", { ascending: true })
      .limit(200),
    // 마지막 활동 — 대기가 없을 때 "언제까지는 돌았다"를 보여주는 용도다.
    admin
      .from(table)
      .select("requested_at, claimed_at")
      .not("claimed_at", "is", null)
      .order("claimed_at", { ascending: false })
      .limit(1),
  ]);

  const rows = (live.data ?? []) as {
    status: string;
    requested_at: string;
    claimed_at: string | null;
  }[];
  const pending = rows.filter((r) => r.status === "pending");
  const running = rows.filter((r) => r.status === "running");
  const last = (recent.data ?? [])[0] as
    | { requested_at: string; claimed_at: string | null }
    | undefined;

  return {
    pendingCount: pending.length,
    oldestPendingAt: pending[0]?.requested_at ?? null,
    runningCount: running.length,
    // running 은 가져간 시각부터 재야 한다 — 요청 시각부터 재면 줄 서 있던
    // 시간까지 처리 시간으로 잡혀 멀쩡한 폴러가 멈춘 것으로 보인다.
    oldestRunningAt: running[0]?.claimed_at ?? running[0]?.requested_at ?? null,
    lastClaimAt: last?.claimed_at ?? null,
    lastRequestAt: last?.requested_at ?? null,
  };
}

/**
 * 심박 — 폴러가 남긴 "살아있음". 한 번에 읽는다(행이 폴러 수만큼뿐이다).
 *
 * 큐가 조용할 때 생사를 가르는 유일한 증거다. 심박을 안 보내는 폴러는 여기 없고,
 * 그때 판정은 예전처럼 unknown 이 된다 — 거짓 안심을 주지 않는다.
 */
async function loadHeartbeats(): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("poller_heartbeats")
    .select("poller_id, beat_at");
  const out = new Map<string, string>();
  for (const r of (data ?? []) as { poller_id: string; beat_at: string }[]) {
    out.set(r.poller_id, r.beat_at);
  }
  return out;
}

/** 폴러 전체 상태. 큐가 여섯 개뿐이라 한꺼번에 읽는다. */
export async function loadPollerStatuses(
  now: Date = new Date(),
): Promise<PollerStatus[]> {
  const beats = await loadHeartbeats();
  return Promise.all(
    POLLERS.map(async (p) => {
      const sample = {
        ...(await sampleQueue(p.table)),
        lastBeatAt: beats.get(p.id) ?? null,
      };
      return {
        ...p,
        ...judgePoller(sample, p.thresholdMinutes, now, p.heartbeatStaleMinutes),
        sample,
      };
    }),
  );
}
