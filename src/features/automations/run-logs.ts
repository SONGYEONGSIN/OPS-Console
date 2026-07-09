import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AutomationRunEntry } from "./types";
import {
  toDepositMatchEntry,
  toMailOperatorEntry,
  toSmileEdiEntry,
  toServiceNoticeEntry,
  toNoticeTeamsEntry,
  toWeeklyReportEntry,
  toClosingRunEntry,
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

// 학교담당자 미수채권 알림 — receivables_mail_sends가 운영자 알림과 동일 스키마라
// mail-operator entry/렌더를 그대로 재사용한다.
/**
 * 수동 발송(인스펙터 '독려 메일 발송')과 cron 발송이 같은 이력 테이블을 공유한다.
 * 자동화 실행 로그에는 cron 발송만 노출해야 "오늘 cron이 돌았는가"를 판단할 수 있으므로
 * triggered_by(=버튼 누른 admin)가 채워진 수동 발송 행은 제외한다.
 */
async function mailSchoolLog(jobId: string): Promise<JobRunLog> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("receivables_mail_sends")
    .select(
      "sent_at, recipient_name, recipient_email, customer_names, receivable_count, total_amount, status, error_message",
    )
    .is("triggered_by", null)
    .order("sent_at", { ascending: false })
    .limit(LOG_LIMIT);
  return {
    jobId,
    kind: "mail-operator",
    entries: (data ?? []).map(toMailOperatorEntry),
  };
}

async function smileEdiLog(jobId: string): Promise<JobRunLog> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("smileedi_mail_sends")
    .select(
      "sent_at, recipient_name, recipient_email, company_names, invoice_count, total_supply_amount, status, error_message",
    )
    .order("sent_at", { ascending: false })
    .limit(LOG_LIMIT);
  return {
    jobId,
    kind: "smileedi",
    entries: (data ?? []).map(toSmileEdiEntry),
  };
}

async function serviceNoticeLog(jobId: string): Promise<JobRunLog> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("service_notice_mail_sends")
    .select(
      "sent_at, target_month, recipient_name, recipient_email, service_count, status, error_message",
    )
    .order("sent_at", { ascending: false })
    .limit(LOG_LIMIT);
  return {
    jobId,
    kind: "service-notice",
    entries: (data ?? []).map(toServiceNoticeEntry),
  };
}

// 공지 Teams 공유 — 별도 sends 테이블 없이 posts.notice_shared_at에 공유 시각을
// 기록한다. 발송 상세 = 공유된 공지 목록(domain='notice' and notice_shared_at not null).
async function noticeTeamsShareLog(jobId: string): Promise<JobRunLog> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("posts")
    .select("title, notice_shared_at, owner_label, author_email")
    .eq("domain", "notice")
    .not("notice_shared_at", "is", null)
    .order("notice_shared_at", { ascending: false })
    .limit(LOG_LIMIT);
  return {
    jobId,
    kind: "notice-teams",
    entries: (data ?? []).map(toNoticeTeamsEntry),
  };
}

// 본부차주보고 알림 — weekly_report_runs 실행 기록 조회.
async function weeklyReportLog(jobId: string): Promise<JobRunLog> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("weekly_report_runs")
    .select(
      "ran_at, status, year, month, week, file_name, sender, share_link, teams_sent, message",
    )
    .order("ran_at", { ascending: false })
    .limit(LOG_LIMIT);
  return {
    jobId,
    kind: "weekly-report",
    entries: (data ?? []).map(toWeeklyReportEntry),
  };
}

// 서비스 마감 스크래핑 — closing_scrape_runs 실행 기록 조회(스크래퍼가 결과 보고).
async function closingScrapeLog(jobId: string): Promise<JobRunLog> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("closing_scrape_runs")
    .select("ran_at, status, service_count, message")
    .order("ran_at", { ascending: false })
    .limit(LOG_LIMIT);
  return {
    jobId,
    kind: "closing-scrape",
    entries: (data ?? []).map(toClosingRunEntry),
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
  "receivables-mail-school": mailSchoolLog,
  "receivables-deposit-match": depositMatchLog,
  "smileedi-mail": smileEdiLog,
  "service-notice-mail": serviceNoticeLog,
  "notice-teams-share": noticeTeamsShareLog,
  "closing-scrape": closingScrapeLog,
  "weekly-report-rollover": weeklyReportLog,
};

export async function getJobRunLog(jobId: string): Promise<JobRunLog> {
  const resolver = LOG_RESOLVERS[jobId];
  if (!resolver) return { jobId, kind: "none", entries: [] };
  return resolver(jobId);
}

/**
 * 공통 실행 이력 — automation_runs에서 잡별 최신 N건(실행·스킵·실패 모두).
 * 발송 0건이어도 실행 자체가 기록되므로, 잡별 결과 테이블 역산 로그를 보완한다.
 */
export async function getAutomationRunLog(
  jobId: string,
): Promise<AutomationRunEntry[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("automation_runs")
    .select("ran_at, ok, skipped, message")
    .eq("job_id", jobId)
    .order("ran_at", { ascending: false })
    .limit(LOG_LIMIT);
  return (data ?? []).map((r) => ({
    ranAt: (r.ran_at as string) ?? "",
    ok: r.ok === true,
    skipped: r.skipped === true,
    message: (r.message as string) ?? "",
  }));
}
