import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

// 발송 이력 테이블의 최신 sent_at 1건을 마지막 실행 시각으로 본다.
async function getLatestSentAt(table: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(table)
    .select("sent_at")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.sent_at ?? null;
}

// closing-scrape는 closing_scrape_runs.ran_at(실행 보고 시각)을 마지막 실행으로 본다.
async function getClosingScrapeLastRunAt(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("closing_scrape_runs")
    .select("ran_at")
    .order("ran_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.ran_at ?? null;
}

// weekly_report_runs는 ran_at(실행 시각)을 마지막 실행으로 본다.
async function getWeeklyReportLastRunAt(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("weekly_report_runs")
    .select("ran_at")
    .order("ran_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.ran_at ?? null;
}

// job별 "마지막 실행 시각" 도출기. 신규 잡 추가 시 여기에 매핑 1줄.
const LAST_RUN_RESOLVERS: Record<string, () => Promise<string | null>> = {
  "insights-collect": getInsightsLastRunAt,
  "receivables-mail-operator": getReceivablesMailOperatorLastRunAt,
  "receivables-mail-school": () => getLatestSentAt("receivables_mail_sends"),
  "receivables-deposit-match": getReceivablesDepositMatchLastRunAt,
  "smileedi-mail": () => getLatestSentAt("smileedi_mail_sends"),
  "service-notice-mail": () => getLatestSentAt("service_notice_mail_sends"),
  "closing-scrape": getClosingScrapeLastRunAt,
  "weekly-report-rollover": getWeeklyReportLastRunAt,
};

// automation_runs의 실제 실행(스킵 제외) 최신 1건을 "마지막 실행"으로 본다.
// 발송 0건이어도 실행이 기록되므로 역산보다 정확하다.
async function getLatestActualRunAt(jobId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("automation_runs")
    .select("ran_at")
    .eq("job_id", jobId)
    .eq("skipped", false)
    .order("ran_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.ran_at ?? null;
}

export async function getJobLastRunAt(jobId: string): Promise<string | null> {
  // automation_runs 우선. 아직 적재 전(전환기)이면 기존 결과 테이블 역산으로 폴백.
  const fromRuns = await getLatestActualRunAt(jobId);
  if (fromRuns) return fromRuns;
  const resolver = LAST_RUN_RESOLVERS[jobId];
  return resolver ? resolver() : null;
}

async function getAutomationSettings(): Promise<Map<string, boolean>> {
  // admin client(service_role) — RLS 우회. cron 진입점(getJobEnabled)은 세션이 없어
  // RLS server client로는 automation_settings(authenticated+is_admin 정책)를 못 읽는다.
  // 자동화 페이지(getAutomationStatuses)도 admin 전용 컨텍스트라 service_role read 안전.
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("automation_settings")
    .select("job_id, enabled");
  const map = new Map<string, boolean>();
  for (const row of data ?? []) {
    if (typeof row.job_id === "string")
      map.set(row.job_id, row.enabled === true);
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
      cooldownRemainingMinutes: computeCooldownRemaining(
        lastRunAt,
        job.cooldownMinutes,
        now,
      ),
      enabled: settings.get(job.id) ?? false,
      localOnly: job.localOnly ?? false,
    });
  }
  return out;
}
