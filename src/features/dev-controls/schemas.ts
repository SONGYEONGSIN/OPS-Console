import { z } from "zod";

export const devControlFlagSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  snippet: z.string(),
  severity: z.enum(["warn", "info"]),
  checked: z.boolean(),
  note: z.string().max(2000),
});
export type DevControlFlag = z.infer<typeof devControlFlagSchema>;

export const updateDevControlFlagSchema = z.object({
  analysisId: z.string().uuid(),
  flagKey: z.string().min(1),
  checked: z.boolean(),
  note: z.string().max(2000),
});

export type DevControlAnalysis = {
  id: string;
  service_id: number;
  file_name: string;
  gen_flag: string;
  kind: "A" | "AU";
  code_hash: string;
  raw_code: string;
  summary_md: string | null;
  flags: DevControlFlag[];
  analyzed_at: string;
};

export const requestDevControlAnalyzeSchema = z.object({
  serviceId: z.number().int().positive(),
});

export type DevControlRequestStatus = "pending" | "running" | "done" | "failed";

export type DevControlAnalyzeRequest = {
  id: string;
  service_id: number;
  /**
   * 무엇을 요청한 것인가 — 같은 큐를 나눠 쓴다.
   * `analyze` 는 수집+분석(운영자용), `spec` 은 학교 안내용 명세.
   * 종류를 안 주는 구버전 행이 있어 선택 필드다.
   */
  kind?: "analyze" | "spec";
  requested_by: string | null;
  status: DevControlRequestStatus;
  requested_at: string;
  claimed_at: string | null;
  finished_at: string | null;
  message: string | null;
};
