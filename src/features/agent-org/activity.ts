"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { AGENT_TEAMS } from "./registry";
import { POLLERS } from "@/features/system-status/pollers";
import {
  jobRunsToActivity,
  queueRowsToActivity,
  type ActivityItem,
  type JobRunRow,
  type QueueRow,
} from "./activity-shape";

/**
 * 에이전트 하나의 최근 활동.
 *
 * **새 테이블을 만들지 않았다.** 이미 남고 있는 것을 읽는다 — 자동화 잡은
 * `automation_runs`, 회사 PC 폴러는 각자의 큐. 인스펙터를 열 때만 부르므로
 * 목록을 그릴 때 29개를 미리 훑지 않는다.
 *
 * 실행 이력이 없는 자리(상시 동작·예정)는 조회 자체를 안 한다 — 빈 배열을
 * 만들자고 DB 를 때릴 이유가 없다.
 */

/** 인스펙터 한 칸에 들어가는 만큼. 더 보려면 자동화 화면으로 간다. */
const LIMIT = 12;

export async function getAgentActivity(agent: string): Promise<ActivityItem[]> {
  const member = AGENT_TEAMS.flatMap((t) => t.members).find(
    (m) => m.agent === agent,
  );
  if (!member) return [];

  const admin = createAdminClient();

  if (member.source.kind === "job") {
    const { data } = await admin
      .from("automation_runs")
      .select("ran_at, ok, skipped, message")
      .eq("job_id", member.source.jobId)
      .order("ran_at", { ascending: false })
      .limit(LIMIT);
    return jobRunsToActivity((data ?? []) as JobRunRow[]);
  }

  if (member.source.kind === "poller") {
    // 콜백 안에서는 좁혀진 타입이 풀린다 — 먼저 꺼내 둔다.
    const { pollerId } = member.source;
    const poller = POLLERS.find((p) => p.id === pollerId);
    if (!poller) return [];
    const { data } = await admin
      .from(poller.table)
      .select("status, requested_at, finished_at")
      .order("requested_at", { ascending: false })
      .limit(LIMIT);
    return queueRowsToActivity((data ?? []) as QueueRow[]);
  }

  return [];
}
