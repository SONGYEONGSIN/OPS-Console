import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { listContracts } from "@/features/contracts/queries";
import { fetchReceivablesSheet } from "@/features/receivables/queries";
import { sumAmountColumn } from "./receivables-amount";
import type { ReportPeriod, KpiItem, KpiSnapshot, ReportRow } from "./schemas";
import { reportRowSchema } from "./schemas";

const KST_DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
});

function kstYmd(d: Date): string {
  return KST_DATE_FMT.format(d);
}

function startOfWeekKstMonday(d: Date): Date {
  // KST ymd 의 정오로 잡으면 UTC day가 KST day와 일치 (자정으로 잡으면 전날 UTC가 됨)
  const ymd = kstYmd(d);
  const noon = new Date(`${ymd}T12:00:00+09:00`);
  const dow = noon.getUTCDay(); // 0(일)~6(토), KST 정오 UTC = 03:00 → KST 같은 day
  // dow 1(월)이면 0, 2(화)이면 1, ..., 0(일)이면 6
  const diff = dow === 0 ? 6 : dow - 1;
  return new Date(noon.getTime() - diff * 86400000);
}

function startOfMonth(year: number, month1: number): string {
  return `${year}-${String(month1).padStart(2, "0")}-01`;
}

function endOfMonth(year: number, month1: number): string {
  // month1 1-12 — 다음달 1일 - 1일
  const next = new Date(Date.UTC(year, month1, 1));
  next.setUTCDate(next.getUTCDate() - 1);
  return kstYmd(next);
}

export type PeriodRange = { startYmd: string; endYmd: string };

export function getPeriodRange(period: ReportPeriod): PeriodRange {
  const now = new Date();
  const todayYmd = kstYmd(now);
  const [yStr, mStr] = todayYmd.split("-");
  const year = Number(yStr);
  const month1 = Number(mStr); // 1-12

  if (period === "this-week") {
    const mon = startOfWeekKstMonday(now);
    const sun = new Date(mon.getTime() + 6 * 86400000);
    return { startYmd: kstYmd(mon), endYmd: kstYmd(sun) };
  }
  if (period === "this-month") {
    return {
      startYmd: startOfMonth(year, month1),
      endYmd: endOfMonth(year, month1),
    };
  }
  if (period === "last-month") {
    const py = month1 === 1 ? year - 1 : year;
    const pm = month1 === 1 ? 12 : month1 - 1;
    return { startYmd: startOfMonth(py, pm), endYmd: endOfMonth(py, pm) };
  }
  if (period === "quarter") {
    // Q1: 1-3 / Q2: 4-6 / Q3: 7-9 / Q4: 10-12
    const qStart = Math.floor((month1 - 1) / 3) * 3 + 1;
    const qEnd = qStart + 2;
    return {
      startYmd: startOfMonth(year, qStart),
      endYmd: endOfMonth(year, qEnd),
    };
  }
  // year
  return { startYmd: `${year}-01-01`, endYmd: `${year}-12-31` };
}

export function getPrevPeriodRange(period: ReportPeriod): PeriodRange {
  const now = new Date();
  const todayYmd = kstYmd(now);
  const [yStr, mStr] = todayYmd.split("-");
  const year = Number(yStr);
  const month1 = Number(mStr);

  if (period === "this-week") {
    const mon = startOfWeekKstMonday(now);
    const prevMon = new Date(mon.getTime() - 7 * 86400000);
    const prevSun = new Date(prevMon.getTime() + 6 * 86400000);
    return { startYmd: kstYmd(prevMon), endYmd: kstYmd(prevSun) };
  }
  if (period === "this-month") {
    const py = month1 === 1 ? year - 1 : year;
    const pm = month1 === 1 ? 12 : month1 - 1;
    return { startYmd: startOfMonth(py, pm), endYmd: endOfMonth(py, pm) };
  }
  if (period === "last-month") {
    const py = month1 <= 2 ? year - 1 : year;
    const pm = (month1 - 2 + 12) % 12 || 12;
    return { startYmd: startOfMonth(py, pm), endYmd: endOfMonth(py, pm) };
  }
  if (period === "quarter") {
    const qStart = Math.floor((month1 - 1) / 3) * 3 + 1;
    const py = qStart === 1 ? year - 1 : year;
    const pqStart = qStart === 1 ? 10 : qStart - 3;
    const pqEnd = pqStart + 2;
    return {
      startYmd: startOfMonth(py, pqStart),
      endYmd: endOfMonth(py, pqEnd),
    };
  }
  // year
  return { startYmd: `${year - 1}-01-01`, endYmd: `${year - 1}-12-31` };
}

function isoStart(ymd: string): string {
  return `${ymd}T00:00:00+09:00`;
}
function isoEnd(ymd: string): string {
  return `${ymd}T23:59:59+09:00`;
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function countTable(
  admin: AdminClient,
  table: string,
  field: string,
  range: PeriodRange,
): Promise<number> {
  const { count, error } = await admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .gte(field, isoStart(range.startYmd))
    .lte(field, isoEnd(range.endYmd));
  if (error) return 0;
  return count ?? 0;
}

/** Date 컬럼(timestamp 아님) 카운트 — incidents.occurred_date 등 */
async function countTableByDate(
  admin: AdminClient,
  table: string,
  field: string,
  range: PeriodRange,
): Promise<number> {
  const { count, error } = await admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .gte(field, range.startYmd)
    .lte(field, range.endYmd);
  if (error) return 0;
  return count ?? 0;
}

async function countMailSent(
  admin: AdminClient,
  range: PeriodRange,
): Promise<number> {
  const tables = [
    "receivables_mail_sends",
    "feedback_mail_sends",
    "backup_request_mail_sends",
  ];
  let total = 0;
  for (const t of tables) {
    const { count } = await admin
      .from(t)
      .select("*", { count: "exact", head: true })
      .gte("sent_at", isoStart(range.startYmd))
      .lte("sent_at", isoEnd(range.endYmd))
      .eq("status", "sent");
    total += count ?? 0;
  }
  return total;
}

async function countContracts(): Promise<number> {
  try {
    const r = await listContracts();
    return r.rows.filter(
      (row) => row.status === "체결완료" || row.status === "계약완료",
    ).length;
  } catch {
    return 0;
  }
}

async function sumReceivables(): Promise<number> {
  try {
    const sheet = await fetchReceivablesSheet();
    if (!sheet) return 0;
    // '청구금액' 컬럼 합산 (원). 시트 전체 미수 행 대상.
    return sumAmountColumn(sheet.headers, sheet.rows, sheet.rowsText);
  } catch {
    return 0;
  }
}

function computeDelta(
  value: number,
  prev: number | null,
): {
  delta: number | null;
  deltaPct: number | null;
} {
  if (prev === null) return { delta: null, deltaPct: null };
  const delta = value - prev;
  if (prev === 0) return { delta, deltaPct: null };
  return { delta, deltaPct: Math.round((delta / prev) * 1000) / 10 };
}

const KPI_META: Record<
  KpiItem["key"],
  { label: string; unit: string; goodOnIncrease: boolean }
> = {
  "service-open": { label: "서비스 오픈", unit: "건", goodOnIncrease: true },
  "service-close": { label: "서비스 마감", unit: "건", goodOnIncrease: true },
  incident: { label: "사고", unit: "건", goodOnIncrease: false },
  contract: { label: "계약 체결", unit: "건", goodOnIncrease: true },
  receivables: { label: "미수채권", unit: "원", goodOnIncrease: false },
  handover: { label: "인수인계", unit: "건", goodOnIncrease: true },
  backup: { label: "백업 요청", unit: "건", goodOnIncrease: false },
  mail: { label: "메일 발송", unit: "건", goodOnIncrease: true },
  worklog: { label: "워크로그", unit: "events", goodOnIncrease: true },
};

function makeKpi(
  key: KpiItem["key"],
  value: number,
  prev: number | null,
): KpiItem {
  const meta = KPI_META[key];
  const { delta, deltaPct } = computeDelta(value, prev);
  return {
    key,
    label: meta.label,
    value,
    prevValue: prev,
    delta,
    deltaPct,
    unit: meta.unit,
    goodOnIncrease: meta.goodOnIncrease,
  };
}

/**
 * 분석보고서 KPI 8 항목 종합 측정.
 * - Supabase 6 도메인 (services / incidents / handover_progress / backup_requests / worklog / mail_sends 3 합산)
 * - SharePoint 2 시트 (contracts / receivables) — 시즌·헤더 매핑 복잡도로 단순 count
 * - 현재 기간 vs 직전 동기간 비교 → delta + %
 */
export async function getReportKpis(
  period: ReportPeriod,
): Promise<KpiSnapshot> {
  const range = getPeriodRange(period);
  const prevRange = getPrevPeriodRange(period);
  const admin = createAdminClient();

  // 서비스 오픈/마감은 '서비스마감' 메뉴 소스(closing_services)에서 조회.
  //   - write_start_at = 원서접수 오픈, write_end_at = 원서접수 마감
  //   - 스크래퍼가 현재 학년도 실데이터를 적재하므로 services 테이블의 -1년 shift 불필요.
  const [
    svcOpenNow,
    svcOpenPrev,
    svcCloseNow,
    svcClosePrev,
    incNow,
    incPrev,
    hoNow,
    hoPrev,
    bkNow,
    bkPrev,
    mailNow,
    mailPrev,
    wlNow,
    wlPrev,
    contractNow,
    rcvNow,
  ] = await Promise.all([
    countTable(admin, "closing_services", "write_start_at", range),
    countTable(admin, "closing_services", "write_start_at", prevRange),
    countTable(admin, "closing_services", "write_end_at", range),
    countTable(admin, "closing_services", "write_end_at", prevRange),
    // incidents는 occurred_date (실제 사고 발생일, date 타입) — created_at은 import 시점
    countTableByDate(admin, "incidents", "occurred_date", range),
    countTableByDate(admin, "incidents", "occurred_date", prevRange),
    countTable(admin, "handover_progress", "created_at", range),
    countTable(admin, "handover_progress", "created_at", prevRange),
    countTable(admin, "backup_requests", "created_at", range),
    countTable(admin, "backup_requests", "created_at", prevRange),
    countMailSent(admin, range),
    countMailSent(admin, prevRange),
    countTable(admin, "worklog", "created_at", range),
    countTable(admin, "worklog", "created_at", prevRange),
    countContracts(),
    sumReceivables(),
  ]);

  // SharePoint 2는 시즌 개념 없어 전 기간 비교 null (1차 MVP)
  const kpis: KpiItem[] = [
    makeKpi("service-open", svcOpenNow, svcOpenPrev),
    makeKpi("service-close", svcCloseNow, svcClosePrev),
    makeKpi("incident", incNow, incPrev),
    makeKpi("contract", contractNow, null),
    makeKpi("receivables", rcvNow, null),
    makeKpi("handover", hoNow, hoPrev),
    makeKpi("backup", bkNow, bkPrev),
    makeKpi("mail", mailNow, mailPrev),
    makeKpi("worklog", wlNow, wlPrev),
  ];

  return {
    period,
    generatedAt: new Date().toISOString(),
    periodRange: range,
    kpis,
  };
}

/* ──────────────────── Persisted reports ──────────────────── */

type DbReportRow = {
  id: string;
  title: string;
  period: string;
  period_start: string;
  period_end: string;
  kpis: unknown;
  status: string;
  share_token: string | null;
  created_by: string;
  created_at: string;
};

function dbRowToReportRow(row: DbReportRow): ReportRow | null {
  const parsed = reportRowSchema.safeParse({
    id: row.id,
    title: row.title,
    period: row.period,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    kpis: row.kpis,
    status: row.status,
    shareToken: row.share_token,
    createdBy: row.created_by,
    createdAt: row.created_at,
  });
  return parsed.success ? parsed.data : null;
}

export async function listReports(): Promise<ReportRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[reports] listReports fail:", error.message);
    return [];
  }
  const rows: ReportRow[] = [];
  for (const r of (data ?? []) as DbReportRow[]) {
    const mapped = dbRowToReportRow(r);
    if (mapped) rows.push(mapped);
  }
  return rows;
}

export async function getReportById(id: string): Promise<ReportRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return dbRowToReportRow(data as DbReportRow);
}

export async function getReportByShareToken(
  token: string,
): Promise<ReportRow | null> {
  if (!token) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("reports")
    .select("*")
    .eq("share_token", token)
    .maybeSingle();
  if (error || !data) return null;
  return dbRowToReportRow(data as DbReportRow);
}
