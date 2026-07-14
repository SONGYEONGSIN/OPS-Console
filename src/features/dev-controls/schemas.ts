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
  gen_flag: string;
  kind: "A" | "AU";
  code_hash: string;
  raw_code: string;
  summary_md: string | null;
  flags: DevControlFlag[];
  analyzed_at: string;
};
