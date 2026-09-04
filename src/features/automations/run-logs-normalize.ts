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

export type AiTipBatchEntry = {
  collectedAt: string;
  candidateCount: number;
  /** 별 많은 순 미리보기. 목록이 아니라 "무엇을 담아왔나"를 알리는 용도다. */
  sampleTitles: string[];
};

export type BriefingEntry = {
  publishedAt: string;
  issueNo: number;
  url: string;
};

/** team_briefings 발행 행 → 로그 entry. 구 행은 published_at이 없어 created_at으로 대체. */
export function toBriefingEntry(
  row: {
    issue_no: number;
    share_token: string;
    published_at: string | null;
    created_at: string;
  },
  baseUrl: string,
): BriefingEntry {
  return {
    publishedAt: row.published_at ?? row.created_at,
    issueNo: row.issue_no,
    url: `${baseUrl}/r/briefing/${row.share_token}`,
  };
}

export type SmileEdiEntry = {
  sentAt: string;
  recipientName: string | null;
  recipientEmail: string;
  companyNames: string[];
  invoiceCount: number;
  totalSupplyAmount: number;
  status: "sent" | "failed" | "dry_run";
  errorMessage: string | null;
};

export type ServiceNoticeEntry = {
  sentAt: string;
  targetMonth: string;
  recipientName: string | null;
  recipientEmail: string;
  serviceCount: number;
  status: "sent" | "failed" | "dry_run";
  errorMessage: string | null;
};

export type NoticeTeamsEntry = {
  sharedAt: string;
  title: string;
  author: string;
};

export type ClosingRunEntry = {
  ranAt: string;
  status: "success" | "skipped" | "failed";
  serviceCount: number;
  message: string | null;
};

export type WeeklyReportEntry = {
  ranAt: string;
  status: "created" | "skipped" | "dry_run" | "failed";
  year: number | null;
  month: number | null;
  week: number | null;
  fileName: string | null;
  sender: string | null;
  shareLink: string | null;
  teamsSent: boolean;
  message: string;
};

/**
 * 경쟁률 점검 실행 1건 — 두 잡(세팅·페이지)이 같은 모양을 쓴다.
 *
 * 지금까지 이 잡만 상세가 없어 한 줄 요약만 떴다. **"링크오류 2건"이 어느
 * 대학인지 화면에서 알 길이 없었다**(2026-09-04).
 */
export type RatioAuditEntry = {
  ranAt: string;
  kind: "schedule" | "page";
  scannedCount: number;
  status: string;
  notified: boolean;
  findings: {
    serviceId: number;
    /** 같은 서비스에 1차·2차가 따로 있어 차수가 필요하다. */
    seq: number;
    universityName: string;
    serviceName: string;
    operatorName: string;
    items: { type: string; field: string; found: string; expect: string }[];
  }[];
  linkErrors: {
    serviceId: number;
    url: string;
    status: number;
    universityName: string;
    serviceName: string;
    operatorName: string;
  }[];
  /** 조용히 빠지면 안 본 것을 본 줄 안다. */
  skipped: { serviceId: number; reason: string }[];
};

export type JobRunLog =
  | { jobId: string; kind: "deposit-match"; entries: DepositMatchEntry[] }
  | { jobId: string; kind: "mail-operator"; entries: MailOperatorEntry[] }
  | { jobId: string; kind: "insights"; entries: InsightsBatchEntry[] }
  | { jobId: string; kind: "ai-tips"; entries: AiTipBatchEntry[] }
  | { jobId: string; kind: "smileedi"; entries: SmileEdiEntry[] }
  | { jobId: string; kind: "service-notice"; entries: ServiceNoticeEntry[] }
  | { jobId: string; kind: "notice-teams"; entries: NoticeTeamsEntry[] }
  | { jobId: string; kind: "closing-scrape"; entries: ClosingRunEntry[] }
  | { jobId: string; kind: "weekly-report"; entries: WeeklyReportEntry[] }
  | { jobId: string; kind: "briefing"; entries: BriefingEntry[] }
  | { jobId: string; kind: "ratio-audit"; entries: RatioAuditEntry[] }
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

type SmileEdiRow = {
  sent_at: string;
  recipient_name: string | null;
  recipient_email: string;
  company_names: string[] | null;
  invoice_count: number | null;
  total_supply_amount: number | null;
  status: "sent" | "failed" | "dry_run";
  error_message: string | null;
};

export function toSmileEdiEntry(row: SmileEdiRow): SmileEdiEntry {
  return {
    sentAt: row.sent_at,
    recipientName: row.recipient_name ?? null,
    recipientEmail: row.recipient_email,
    companyNames: Array.isArray(row.company_names) ? row.company_names : [],
    invoiceCount: row.invoice_count ?? 0,
    totalSupplyAmount: row.total_supply_amount ?? 0,
    status: row.status,
    errorMessage: row.error_message ?? null,
  };
}

type ServiceNoticeRow = {
  sent_at: string;
  target_month: string;
  recipient_name: string | null;
  recipient_email: string;
  service_count: number | null;
  status: "sent" | "failed" | "dry_run";
  error_message: string | null;
};

export function toServiceNoticeEntry(
  row: ServiceNoticeRow,
): ServiceNoticeEntry {
  return {
    sentAt: row.sent_at,
    targetMonth: row.target_month,
    recipientName: row.recipient_name ?? null,
    recipientEmail: row.recipient_email,
    serviceCount: row.service_count ?? 0,
    status: row.status,
    errorMessage: row.error_message ?? null,
  };
}

type NoticeTeamsRow = {
  title: string;
  notice_shared_at: string;
  owner_label: string | null;
  author_email: string;
};

export function toNoticeTeamsEntry(row: NoticeTeamsRow): NoticeTeamsEntry {
  return {
    sharedAt: row.notice_shared_at,
    title: row.title,
    author: row.owner_label ?? row.author_email,
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

export type AiTipCandidateRow = {
  collected_at: string;
  draft_title: string | null;
  repo_full_name: string;
  stars: number | null;
};

/**
 * AI TIP 후보를 수집 시각으로 묶는다 — insights와 같은 구조다.
 *
 * 둘 다 run 테이블이 없어 `collected_at`으로 배치를 복원한다. 전에는 실행
 * 이력만 있어 "후보 5건 수집" 한 줄이 전부였고, 무엇을 담아왔는지 볼 수 없었다.
 */
export function groupAiTipBatches(
  rows: AiTipCandidateRow[],
  maxBatches: number,
  sampleSize = 3,
): AiTipBatchEntry[] {
  const groups = new Map<string, { title: string; stars: number }[]>();
  for (const r of rows) {
    const list = groups.get(r.collected_at) ?? [];
    // claude가 초안 제목을 못 만들었어도 무엇을 담았는지는 남아야 한다.
    list.push({
      title: r.draft_title?.trim() || r.repo_full_name,
      stars: r.stars ?? -1,
    });
    groups.set(r.collected_at, list);
  }
  return Array.from(groups.keys())
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .slice(0, maxBatches)
    .map((key) => {
      const list = groups.get(key) ?? [];
      return {
        collectedAt: key,
        candidateCount: list.length,
        sampleTitles: [...list]
          .sort((a, b) => b.stars - a.stars)
          .slice(0, sampleSize)
          .map((x) => x.title),
      };
    });
}

type WeeklyReportRunRow = {
  ran_at: string;
  status: "created" | "skipped" | "dry_run" | "failed";
  year: number | null;
  month: number | null;
  week: number | null;
  file_name: string | null;
  sender: string | null;
  share_link: string | null;
  teams_sent: boolean | null;
  message: string;
};

export function toWeeklyReportEntry(
  row: WeeklyReportRunRow,
): WeeklyReportEntry {
  return {
    ranAt: row.ran_at,
    status: row.status,
    year: row.year ?? null,
    month: row.month ?? null,
    week: row.week ?? null,
    fileName: row.file_name ?? null,
    sender: row.sender ?? null,
    shareLink: row.share_link ?? null,
    teamsSent: row.teams_sent ?? false,
    message: row.message,
  };
}

type ClosingRunRow = {
  ran_at: string;
  status: "success" | "skipped" | "failed";
  service_count: number | null;
  message: string | null;
};

type RatioAuditRow = {
  ran_at?: string | null;
  kind?: string | null;
  payload?: Record<string, unknown> | null;
  status?: string | null;
  notified?: boolean | null;
};

/**
 * `ratio_audit_runs` 한 줄 → 화면용.
 *
 * payload 는 스크래퍼가 보낸 것이라 **비어 있거나 구버전일 수 있다** — 그 행 하나가
 * 화면을 깨면 나머지 이력도 못 본다. 없는 건 빈 배열·0 으로 둔다.
 */
export function toRatioAuditEntry(row: RatioAuditRow): RatioAuditEntry {
  const p = (row.payload ?? {}) as Record<string, unknown>;
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    ranAt: row.ran_at ?? "",
    kind: row.kind === "page" ? "page" : "schedule",
    scannedCount: typeof p.scannedCount === "number" ? p.scannedCount : 0,
    status: row.status ?? "",
    notified: row.notified === true,
    findings: arr<RatioAuditEntry["findings"][number]>(p.findings),
    linkErrors: arr<RatioAuditEntry["linkErrors"][number]>(p.linkErrors),
    skipped: arr<RatioAuditEntry["skipped"][number]>(p.skipped),
  };
}

export function toClosingRunEntry(row: ClosingRunRow): ClosingRunEntry {
  return {
    ranAt: row.ran_at,
    status: row.status,
    serviceCount: row.service_count ?? 0,
    message: row.message ?? null,
  };
}
