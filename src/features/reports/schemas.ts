import { z } from "zod";

/**
 * 분석보고서 — 기간 selector 5 옵션.
 * - this-week / this-month / last-month / quarter / year (현재 분기·연간)
 */
export const reportPeriodSchema = z.enum([
  "this-week",
  "this-month",
  "last-month",
  "quarter",
  "year",
]);
export type ReportPeriod = z.infer<typeof reportPeriodSchema>;

export const REPORT_PERIOD_LABELS: Record<ReportPeriod, string> = {
  "this-week": "이번 주",
  "this-month": "이번 달",
  "last-month": "지난 달",
  quarter: "분기",
  year: "연간",
};

/**
 * 단일 KPI 카드 데이터.
 * - tone: 증감의 의미 — services/contracts/handover/mail/worklog는 증가가 good,
 *   incidents는 감소가 good, receivables(미수)는 감소가 good
 */
export const kpiItemSchema = z.object({
  key: z.enum([
    "service-open",
    "incident",
    "contract",
    "receivables",
    "handover",
    "backup",
    "mail",
    "worklog",
  ]),
  label: z.string(),
  value: z.number(),
  /** 직전 동기간 값. 분모로 사용 — null이면 비교 불가 */
  prevValue: z.number().nullable(),
  /** 절대 증감 (value - prevValue). null이면 비교 불가 */
  delta: z.number().nullable(),
  /** % 증감. 분모 0 또는 비교 불가면 null */
  deltaPct: z.number().nullable(),
  /** 표시 단위 (예: "건", "K", "events") */
  unit: z.string(),
  /** 증가 = good / bad / neutral (사고는 감소가 good) */
  goodOnIncrease: z.boolean(),
});
export type KpiItem = z.infer<typeof kpiItemSchema>;

export const kpiSnapshotSchema = z.object({
  period: reportPeriodSchema,
  /** ISO 8601 — 측정 시점 */
  generatedAt: z.string(),
  /** 현재 기간 범위 (UI 표시용) */
  periodRange: z.object({ startYmd: z.string(), endYmd: z.string() }),
  kpis: z.array(kpiItemSchema),
});
export type KpiSnapshot = z.infer<typeof kpiSnapshotSchema>;
