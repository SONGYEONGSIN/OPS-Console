import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// broadsheet 실시간 현황 타임라인용 — 오늘 실행된 자동화 잡을 8개 이력 테이블에서
// union으로 모은다. admin 전용 컨텍스트로 run-logs.ts와 동일하게 service_role read.

const TABLE_FETCH_LIMIT = 50;

/**
 * todayYmd("YYYY-MM-DD") → 그 날 00:00~익일 00:00 (KST) 의 ISO 경계.
 * 날짜 +1 은 UTC 기준 Date 연산으로 처리해 윤년/월말을 안전하게 넘긴다.
 */
export function kstDayRangeIso(todayYmd: string): {
  startIso: string;
  endIso: string;
} {
  const startIso = `${todayYmd}T00:00:00+09:00`;
  const next = new Date(`${todayYmd}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const nextYmd = next.toISOString().slice(0, 10);
  const endIso = `${nextYmd}T00:00:00+09:00`;
  return { startIso, endIso };
}

export type AutomationRun = { id: string; atIso: string; label: string };

type RunSource = { jobId: string; table: string; col: string; label: string };

const RUN_SOURCES: RunSource[] = [
  {
    jobId: "receivables-deposit-match",
    table: "receivables_match_runs",
    col: "started_at",
    label: "입금 매칭 자동화",
  },
  {
    jobId: "receivables-mail-operator",
    table: "receivables_operator_mail_sends",
    col: "sent_at",
    label: "운영자 미수채권 알림",
  },
  {
    jobId: "receivables-mail-school",
    table: "receivables_mail_sends",
    col: "sent_at",
    label: "학교담당자 미수채권 알림",
  },
  {
    jobId: "smileedi-mail",
    table: "smileedi_mail_sends",
    col: "sent_at",
    label: "세금계산서 역발행 알림",
  },
  {
    jobId: "service-notice-mail",
    table: "service_notice_mail_sends",
    col: "sent_at",
    label: "월별 서비스 알림",
  },
  {
    jobId: "weekly-report-rollover",
    table: "weekly_report_runs",
    col: "ran_at",
    label: "본부차주보고 알림",
  },
  {
    jobId: "closing-scrape",
    table: "closing_scrape_runs",
    col: "ran_at",
    label: "서비스 마감 스크래핑",
  },
  {
    jobId: "insights-collect",
    table: "insight_videos",
    col: "collected_at",
    label: "인사이트 영상 수집",
  },
];

async function fetchSourceRuns(
  source: RunSource,
  startIso: string,
  endIso: string,
): Promise<AutomationRun[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from(source.table)
    .select(source.col)
    .gte(source.col, startIso)
    .lt(source.col, endIso)
    .order(source.col, { ascending: false })
    .limit(TABLE_FETCH_LIMIT);
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  return rows.flatMap((row, idx) => {
    const at = row[source.col];
    if (typeof at !== "string" || at.length === 0) return [];
    return [{ id: `${source.jobId}-${idx}`, atIso: at, label: source.label }];
  });
}

export async function listTodayAutomationRuns(
  todayYmd: string,
): Promise<AutomationRun[]> {
  const { startIso, endIso } = kstDayRangeIso(todayYmd);
  const perTable = await Promise.all(
    RUN_SOURCES.map((source) => fetchSourceRuns(source, startIso, endIso)),
  );
  return perTable.flat().sort((a, b) => b.atIso.localeCompare(a.atIso));
}
