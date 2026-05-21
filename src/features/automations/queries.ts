import "server-only";
import { createClient } from "@/lib/supabase/server";
import { AUTOMATION_JOBS } from "./registry";
import type { AutomationStatus } from "./types";

export function computeCooldownRemaining(
  lastRunAt: string | null,
  cooldownMinutes: number,
  now: Date,
): number {
  if (!lastRunAt) return 0;
  const elapsedMs = now.getTime() - new Date(lastRunAt).getTime();
  const remainingMs = cooldownMinutes * 60_000 - elapsedMs;
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / 60_000);
}

async function getInsightsLastRunAt(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("insight_videos")
    .select("collected_at")
    .order("collected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.collected_at ?? null;
}

// job별 "마지막 실행 시각" 도출기. 신규 잡 추가 시 여기에 매핑 1줄.
const LAST_RUN_RESOLVERS: Record<string, () => Promise<string | null>> = {
  "insights-collect": getInsightsLastRunAt,
};

export async function getJobLastRunAt(jobId: string): Promise<string | null> {
  const resolver = LAST_RUN_RESOLVERS[jobId];
  return resolver ? resolver() : null;
}

export async function getAutomationStatuses(): Promise<AutomationStatus[]> {
  const now = new Date();
  const out: AutomationStatus[] = [];
  for (const job of AUTOMATION_JOBS) {
    const lastRunAt = await getJobLastRunAt(job.id);
    out.push({
      id: job.id,
      label: job.label,
      description: job.description,
      scheduleInfo: job.scheduleInfo,
      cooldownMinutes: job.cooldownMinutes,
      lastRunAt,
      cooldownRemainingMinutes: computeCooldownRemaining(
        lastRunAt,
        job.cooldownMinutes,
        now,
      ),
    });
  }
  return out;
}
