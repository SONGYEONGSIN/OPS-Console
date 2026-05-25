import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { listContracts } from "@/features/contracts/queries";
import { fetchReceivablesSheet } from "@/features/receivables/queries";
import type { ReportPeriod, KpiItem, KpiSnapshot } from "./schemas";

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
    return { startYmd: startOfMonth(year, month1), endYmd: endOfMonth(year, month1) };
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
    return { startYmd: startOfMonth(year, qStart), endYmd: endOfMonth(year, qEnd) };
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
    const pm = ((month1 - 2 + 12) % 12) || 12;
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
    // 단순 합계 — 헤더 매핑 없이 receivablesToListRow의 author(금액) 사용은 복잡.
    // 1차 MVP는 active row 수만 (금액 합산은 follow-up).
    return sheet.rows.length;
  } catch {
    return 0;
  }
}

function computeDelta(value: number, prev: number | null): {
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
  incident: { label: "사고", unit: "건", goodOnIncrease: false },
  contract: { label: "계약 체결", unit: "건", goodOnIncrease: true },
  receivables: { label: "미수채권", unit: "건", goodOnIncrease: false },
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

  // Supabase 도메인 6 — 현재 + 전 기간 병렬
  const [
    svcNow,
    svcPrev,
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
    countTable(admin, "services", "write_start_at", range),
    countTable(admin, "services", "write_start_at", prevRange),
    countTable(admin, "incidents", "created_at", range),
    countTable(admin, "incidents", "created_at", prevRange),
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
    makeKpi("service-open", svcNow, svcPrev),
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
