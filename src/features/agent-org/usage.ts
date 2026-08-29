import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { AGENT_TEAMS } from "./registry";
import { POLLERS } from "@/features/system-status/pollers";
import { lastKstDays, foldByKstDay } from "./usage-fold";

/**
 * 에이전트별 사용량 — 오늘 건수 + 최근 N일 추이.
 *
 * **새 테이블을 만들지 않았다.** 이미 남고 있는 것을 에이전트 단위로 접을 뿐이다 —
 * 자동화 잡은 `automation_runs(job_id, ran_at)`, 회사 PC 폴러는 각자의 큐 테이블
 * (`requested_at`). 기록을 새로 남기기 시작하는 건 그 다음 일이고, 이걸로 오늘
 * 당장 화면에 진짜 숫자가 뜬다.
 *
 * 실행 기록이 없는 자리(`outside`·`planned`)는 **0 이 아니라 null** 이다. 안 돈
 * 것과 셀 수 없는 것을 같은 0으로 그리면 화면이 조용히 거짓말을 한다.
 */

export type AgentUsage = {
  /** 최근 N일 일별 건수(오름차순). 셀 수 없으면 null. */
  daily: number[] | null;
  /** 오늘 건수. 셀 수 없으면 null. */
  today: number | null;
};

/** 며칠치를 볼지. 카드 막대가 읽히는 최소치가 7이다. */
export const USAGE_DAYS = 7;

export async function loadAgentUsage(
  now: Date = new Date(),
  days: number = USAGE_DAYS,
): Promise<Record<string, AgentUsage>> {
  const admin = createAdminClient();
  const ymds = lastKstDays(days, now);
  const sinceIso = `${ymds[0]}T00:00:00+09:00`;

  const members = AGENT_TEAMS.flatMap((t) => t.members);
  const pollerTable = new Map(POLLERS.map((p) => [p.id, p.table]));

  // 잡은 한 번에 읽어 job_id 로 가른다 — 잡마다 조회하면 18번 왕복한다.
  const jobRows = await admin
    .from("automation_runs")
    .select("job_id, ran_at")
    .gte("ran_at", sinceIso);
  const byJob = new Map<string, string[]>();
  for (const r of (jobRows.data ?? []) as { job_id: string; ran_at: string }[]) {
    const list = byJob.get(r.job_id) ?? [];
    list.push(r.ran_at);
    byJob.set(r.job_id, list);
  }

  // 폴러 큐는 테이블이 제각각이라 따로 읽되 병렬로 간다.
  const pollerIds = [
    ...new Set(
      members.flatMap((m) => (m.source.kind === "poller" ? [m.source.pollerId] : [])),
    ),
  ];
  const pollerAt = new Map<string, string[]>(
    await Promise.all(
      pollerIds.map(async (id) => {
        const table = pollerTable.get(id);
        if (!table) return [id, []] as [string, string[]];
        const res = await admin
          .from(table)
          .select("requested_at")
          .gte("requested_at", sinceIso);
        const at = ((res.data ?? []) as { requested_at: string }[]).map(
          (r) => r.requested_at,
        );
        return [id, at] as [string, string[]];
      }),
    ),
  );

  const out: Record<string, AgentUsage> = {};
  for (const m of members) {
    const at =
      m.source.kind === "job"
        ? byJob.get(m.source.jobId)
        : m.source.kind === "poller"
          ? pollerAt.get(m.source.pollerId)
          : undefined;
    if (at === undefined) {
      // 셀 수 없는 자리 — 0 으로 그리면 '안 돌았다'로 읽힌다.
      out[m.agent] = { daily: null, today: null };
      continue;
    }
    const daily = foldByKstDay(at, ymds);
    out[m.agent] = { daily, today: daily[daily.length - 1] };
  }
  return out;
}
