import { z } from "zod";

/** 테스트 실행 상태 — pending(대기) → running(claim) → done/failed/error. */
export const ENTERTEST_RUN_STATUSES = [
  "pending",
  "running",
  "done",
  "failed",
  "error",
] as const;
export const entertestRunStatusSchema = z.enum(ENTERTEST_RUN_STATUSES);
export type EntertestRunStatus = z.infer<typeof entertestRunStatusSchema>;

/** 케이스별 체크 결과. screenshot_url은 실패 시에만. */
export const entertestCheckSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  status: z.enum(["pass", "fail", "skip"]),
  message: z.string().nullable(),
  screenshot_url: z.string().optional(),
});
export type EntertestCheck = z.infer<typeof entertestCheckSchema>;

/** 러너 → /api/entertest/ingest 페이로드. summary는 서버가 계산. */
export const entertestIngestSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["done", "failed"]),
  checks: z.array(entertestCheckSchema),
  error_message: z.string().optional(),
});
export type EntertestIngest = z.infer<typeof entertestIngestSchema>;

/** 집계 요약 — result.checks 기준. */
export const entertestSummarySchema = z.object({
  pass: z.number().int(),
  fail: z.number().int(),
  total: z.number().int(),
});
export type EntertestSummary = z.infer<typeof entertestSummarySchema>;

/** result jsonb 형태. */
export const entertestResultSchema = z.object({
  checks: z.array(entertestCheckSchema),
  summary: entertestSummarySchema,
});
export type EntertestResult = z.infer<typeof entertestResultSchema>;

/** entertest_test_runs 행 (UI/쿼리용). */
export const entertestRunSchema = z.object({
  id: z.string().uuid(),
  requested_by: z.string(),
  requested_at: z.string(),
  target_url: z.string(),
  status: entertestRunStatusSchema,
  claimed_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  result: entertestResultSchema.nullable(),
  error_message: z.string().nullable(),
});
export type EntertestRun = z.infer<typeof entertestRunSchema>;
