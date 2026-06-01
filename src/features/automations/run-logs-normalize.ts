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

/** 불일치 1건 — 표시 줄 + 적용(승인) 액션에 필요한 행번호/거래처/거래내용. */
export type DepositMismatchItem = {
  line: string;
  misuRow: number;
  depRow: number;
  misuCustomer: string;
  depContent: string;
};

export type DepositMatchEntry = {
  startedAt: string;
  finishedAt: string | null;
  mode: "dry_run" | "live";
  matchedCount: number;
  mismatchCount: number;
  errorCount: number;
  matchedLines: string[];
  mismatchLines: string[];
  mismatchItems: DepositMismatchItem[];
  errorLines: string[];
  skipLines: string[];
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

/**
 * 로그 표시용 매칭 쌍 — MatchPair(행번호만)에 거래처/거래내용 이름을 덧붙인 형태.
 * 잡이 payload에 저장할 때 enrichMatchedForLog로 채운다. 이름이 없는 구 이력은
 * summarizeMatch가 행번호로 폴백.
 */
export type LoggedMatchPair = MatchPair & {
  misuCustomers?: string[];
  depContents?: string[];
};

/** 매칭 쌍의 행번호를 실제 거래처/거래내용 이름으로 매핑해 로그 표시용으로 보강. */
export function enrichMatchedForLog(
  matched: MatchPair[],
  misuRows: { rowNumber: number; customer: string }[],
  deposits: { row: number; content: string }[],
): LoggedMatchPair[] {
  const misuByRow = new Map(misuRows.map((m) => [m.rowNumber, m.customer]));
  const depByRow = new Map(deposits.map((d) => [d.row, d.content]));
  return matched.map((p) => ({
    ...p,
    misuCustomers: p.misuRows.map((r) => misuByRow.get(r) || `행${r}`),
    depContents: p.depRows.map((r) => depByRow.get(r) || `행${r}`),
  }));
}

export function summarizeMatch(m: LoggedMatchPair): string {
  const kind = MATCH_KIND_LABEL[m.kind];
  const misuNames = m.misuCustomers ?? [];
  const depNames = m.depContents ?? [];
  if (misuNames.length > 0 || depNames.length > 0) {
    const misu = misuNames.join(", ") || "?";
    const dep = depNames.join(", ") || "?";
    return `${formatKrw(m.amount)} ${kind} 매칭 (${misu} ↔ ${dep})`;
  }
  // 이름이 없는 구 이력 — 행번호 폴백
  return `${formatKrw(m.amount)} ${kind} 매칭 (미수행 ${m.misuRows.join(",")} ↔ 입금행 ${m.depRows.join(",")})`;
}

type DepositMatchRow = {
  started_at: string;
  finished_at: string | null;
  mode: "dry_run" | "live";
  matched_count: number;
  mismatch_count: number;
  error_count: number;
  payload: {
    matched?: LoggedMatchPair[];
    mismatches?: MismatchPair[];
    errors?: string[];
    skips?: string[];
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
  const skips = Array.isArray(row.payload?.skips) ? row.payload.skips : [];
  return {
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? null,
    mode: row.mode,
    matchedCount: row.matched_count ?? 0,
    mismatchCount: row.mismatch_count ?? 0,
    errorCount: row.error_count ?? 0,
    matchedLines: matched.map(summarizeMatch),
    mismatchLines: mismatches.map(summarizeMismatch),
    mismatchItems: mismatches.map((m) => ({
      line: summarizeMismatch(m),
      misuRow: m.misuRow,
      depRow: m.depRow,
      misuCustomer: m.misuCustomer,
      depContent: m.depContent,
    })),
    errorLines: errors,
    skipLines: skips,
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
