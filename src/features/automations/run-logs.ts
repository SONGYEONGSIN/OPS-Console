import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  toDepositMatchEntry,
  toMailOperatorEntry,
  groupInsightsBatches,
  type JobRunLog,
} from "./run-logs-normalize";

// 인스펙터에 한 번에 표시할 최근 실행 이력 수.
const LOG_LIMIT = 20;
// insights는 run 테이블이 없어 collected_at로 배치를 복원한다. run당 최대 10건
// 적재되므로 넉넉히 fetch해 20 배치를 확보한다.
const INSIGHTS_FETCH_ROWS = 400;

// admin 전용 페이지 컨텍스트 — getAutomationStatuses와 동일하게 service_role read.
// match_runs/operator_mail_sends RLS 분기를 피하고 일관된 조회 경로를 쓴다.

async function depositMatchLog(jobId: string): Promise<JobRunLog> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("receivables_match_runs")
    .select(
      "started_at, finished_at, mode, matched_count, mismatch_count, error_count, payload",
    )
    .order("started_at", { ascending: false })
    .limit(LOG_LIMIT);
  return {
    jobId,
    kind: "deposit-match",
    entries: (data ?? []).map(toDepositMatchEntry),
  };
}

async function mailOperatorLog(jobId: string): Promise<JobRunLog> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("receivables_operator_mail_sends")
    .select(
      "sent_at, recipient_name, recipient_email, customer_names, receivable_count, total_amount, status, error_message",
    )
    .order("sent_at", { ascending: false })
    .limit(LOG_LIMIT);
  return {
    jobId,
    kind: "mail-operator",
    entries: (data ?? []).map(toMailOperatorEntry),
  };
}

async function insightsLog(jobId: string): Promise<JobRunLog> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("insight_videos")
    .select("collected_at, title, view_count")
    .order("collected_at", { ascending: false })
    .limit(INSIGHTS_FETCH_ROWS);
  return {
    jobId,
    kind: "insights",
    entries: groupInsightsBatches(data ?? [], LOG_LIMIT),
  };
}

const LOG_RESOLVERS: Record<string, (jobId: string) => Promise<JobRunLog>> = {
  "insights-collect": insightsLog,
  "receivables-mail-operator": mailOperatorLog,
  "receivables-deposit-match": depositMatchLog,
};

export async function getJobRunLog(jobId: string): Promise<JobRunLog> {
  const resolver = LOG_RESOLVERS[jobId];
  if (!resolver) return { jobId, kind: "none", entries: [] };
  return resolver(jobId);
}
