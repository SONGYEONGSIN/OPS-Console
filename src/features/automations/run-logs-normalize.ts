/**
 * 자동화 실행 로그 정규화 — 순수 변환 (DB 조회 없음, server-only 아님).
 *
 * 잡마다 이력 저장 구조가 다르므로(입금매칭=run당 1행, 운영자메일=발송당 1행,
 * 인사이트=수집 영상 행) 인스펙터 패널이 소비할 공통 entry 형태로 변환한다.
 * I/O는 run-logs.ts(server-only)가 담당하고, 본 모듈은 매핑/요약만 한다.
 */
import type {
  MatchPair,
  MismatchPair,
} from "@/features/receivables-match/types";

export type DepositMatchEntry = {
  startedAt: string;
  finishedAt: string | null;
  mode: "dry_run" | "live";
  matchedCount: number;
  mismatchCount: number;
  errorCount: number;
  matchedLines: string[];
  mismatchLines: string[];
  errorLines: string[];
};

export type MailOperatorEntry = {
  sentAt: string;
  recipientName: string | null;
  recipientEmail: string;
  customerNames: string[];
  receivableCount: number;
  totalAmount: number;
  status: "sent" | "failed" | "dry_run";
  errorMessage: string | null;
};

export type InsightsBatchEntry = {
  collectedAt: string;
  videoCount: number;
  sampleTitles: string[];
};

export type JobRunLog =
  | { jobId: string; kind: "deposit-match"; entries: DepositMatchEntry[] }
  | { jobId: string; kind: "mail-operator"; entries: MailOperatorEntry[] }
  | { jobId: string; kind: "insights"; entries: InsightsBatchEntry[] }
  | { jobId: string; kind: "none"; entries: [] };

export function formatKrw(amount: number): string {
  return `₩${Math.round(amount).toLocaleString("ko-KR")}`;
}

export function summarizeMismatch(m: MismatchPair): string {
  const customer = m.misuCustomer || "?";
  const content = m.depContent || "?";
  return `${customer} ${formatKrw(m.amount)} — 입금 '${content}' (미수행 ${m.misuRow} ↔ 입금행 ${m.depRow})`;
}

const MATCH_KIND_LABEL: Record<MatchPair["kind"], string> = {
  oneToOne: "1:1",
  nToOne: "N:1",
  nToM: "N:M",
};

export function summarizeMatch(m: MatchPair): string {
  return `${formatKrw(m.amount)} ${MATCH_KIND_LABEL[m.kind]} 매칭 (미수행 ${m.misuRows.join(",")} ↔ 입금행 ${m.depRows.join(",")})`;
}

type DepositMatchRow = {
  started_at: string;
  finished_at: string | null;
  mode: "dry_run" | "live";
  matched_count: number;
  mismatch_count: number;
  error_count: number;
  payload: {
    matched?: MatchPair[];
    mismatches?: MismatchPair[];
    errors?: string[];
  } | null;
};

export function toDepositMatchEntry(row: DepositMatchRow): DepositMatchEntry {
  const matched = Array.isArray(row.payload?.matched)
    ? row.payload.matched
    : [];
  const mismatches = Array.isArray(row.payload?.mismatches)
    ? row.payload.mismatches
    : [];
  const errors = Array.isArray(row.payload?.errors) ? row.payload.errors : [];
  return {
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? null,
    mode: row.mode,
    matchedCount: row.matched_count ?? 0,
    mismatchCount: row.mismatch_count ?? 0,
    errorCount: row.error_count ?? 0,
    matchedLines: matched.map(summarizeMatch),
    mismatchLines: mismatches.map(summarizeMismatch),
    errorLines: errors,
  };
}

type MailOperatorRow = {
  sent_at: string;
  recipient_name: string | null;
  recipient_email: string;
  customer_names: string[] | null;
  receivable_count: number;
  total_amount: number;
  status: "sent" | "failed" | "dry_run";
  error_message: string | null;
};

export function toMailOperatorEntry(row: MailOperatorRow): MailOperatorEntry {
  return {
    sentAt: row.sent_at,
    recipientName: row.recipient_name ?? null,
    recipientEmail: row.recipient_email,
    customerNames: Array.isArray(row.customer_names) ? row.customer_names : [],
    receivableCount: row.receivable_count ?? 0,
    totalAmount: row.total_amount ?? 0,
    status: row.status,
    errorMessage: row.error_message ?? null,
  };
}

type InsightVideoRow = {
  collected_at: string;
  title: string;
  view_count: number | null;
};

/**
 * insight_videos 행을 collected_at(= 실행 트랜잭션 시각) 단위로 묶어 "수집 배치"를
 * 복원한다. 같은 실행에서 신규 적재된 영상은 now() 트랜잭션 시각이 동일하므로
 * collected_at가 곧 배치 키가 된다. 최신 배치부터 maxBatches개까지.
 */
export function groupInsightsBatches(
  rows: InsightVideoRow[],
  maxBatches: number,
  sampleSize = 3,
): InsightsBatchEntry[] {
  const groups = new Map<string, { title: string; vc: number }[]>();
  for (const r of rows) {
    const key = r.collected_at;
    const list = groups.get(key) ?? [];
    list.push({ title: r.title, vc: r.view_count ?? -1 });
    groups.set(key, list);
  }
  return Array.from(groups.keys())
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .slice(0, maxBatches)
    .map((key) => {
      const titles = groups.get(key) ?? [];
      const sampleTitles = [...titles]
        .sort((a, b) => b.vc - a.vc)
        .slice(0, sampleSize)
        .map((t) => t.title);
      return { collectedAt: key, videoCount: titles.length, sampleTitles };
    });
}
