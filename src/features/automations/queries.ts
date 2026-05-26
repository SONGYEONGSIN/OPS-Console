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

async function getReceivablesMailOperatorLastRunAt(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("receivables_operator_mail_sends")
    .select("sent_at")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.sent_at ?? null;
}

async function getReceivablesDepositMatchLastRunAt(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("receivables_match_runs")
    .select("started_at")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.started_at ?? null;
}

// job별 "마지막 실행 시각" 도출기. 신규 잡 추가 시 여기에 매핑 1줄.
const LAST_RUN_RESOLVERS: Record<string, () => Promise<string | null>> = {
  "insights-collect": getInsightsLastRunAt,
  "receivables-mail-operator": getReceivablesMailOperatorLastRunAt,
  "receivables-deposit-match": getReceivablesDepositMatchLastRunAt,
};

export async function getJobLastRunAt(jobId: string): Promise<string | null> {
  const resolver = LAST_RUN_RESOLVERS[jobId];
  return resolver ? resolver() : null;
}

async function getAutomationSettings(): Promise<Map<string, boolean>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("automation_settings")
    .select("job_id, enabled");
  const map = new Map<string, boolean>();
  for (const row of data ?? []) {
    if (typeof row.job_id === "string") map.set(row.job_id, row.enabled === true);
  }
  return map;
}

export async function getJobEnabled(jobId: string): Promise<boolean> {
  const settings = await getAutomationSettings();
  return settings.get(jobId) ?? false;
}

export async function getAutomationStatuses(): Promise<AutomationStatus[]> {
  const now = new Date();
  const settings = await getAutomationSettings();
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
      cooldownRemainingMinutes: computeCooldownRemaining(lastRunAt, job.cooldownMinutes, now),
      enabled: settings.get(job.id) ?? false,
    });
  }
  return out;
}
