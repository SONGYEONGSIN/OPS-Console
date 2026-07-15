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
  requested_by: string | null;
  status: DevControlRequestStatus;
  requested_at: string;
  claimed_at: string | null;
  finished_at: string | null;
  message: string | null;
};
