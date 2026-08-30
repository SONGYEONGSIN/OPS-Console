import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { lastKstDays } from "./usage-fold";
import { foldCost, type AgentCost } from "./cost-fold";
import { USAGE_DAYS } from "./usage";

/**
 * 토큰·비용을 남기는 에이전트 → 그 이력 테이블.
 *
 * **지금은 한 곳뿐이다.** 나머지 LLM 에이전트 5개(메일함·경쟁률·우편물·개발탭·
 * 소식지)는 회사 PC 에서 `claude -p` CLI 를 부르는데 그쪽은 응답 본문만 받고
 * usage 를 안 준다 — 각자 이력 테이블에 컬럼을 만들고 스크립트를 고쳐야 값이
 * 생긴다. 여기에 줄을 늘리는 게 그 작업의 마지막 단계다.
 */
const COST_SOURCE: Record<string, { table: string; at: string }> = {
  "assistant-runner": { table: "assistant_requests", at: "requested_at" },
};

export type AgentCostMap = Record<string, AgentCost | null>;

export async function loadAgentCost(
  now: Date = new Date(),
  days: number = USAGE_DAYS,
): Promise<AgentCostMap> {
  const admin = createAdminClient();
  const sinceIso = `${lastKstDays(days, now)[0]}T00:00:00+09:00`;

  const entries = await Promise.all(
    Object.entries(COST_SOURCE).map(async ([agent, src]) => {
      const { data } = await admin
        .from(src.table)
        .select("input_tokens, output_tokens, cache_read_tokens, cost_usd, model")
        .gte(src.at, sinceIso)
        .not("input_tokens", "is", null);
      return [agent, foldCost(data ?? [])] as const;
    }),
  );
  return Object.fromEntries(entries);
}
