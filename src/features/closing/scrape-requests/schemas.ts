import { z } from "zod";

/** 로컬 스크랩 요청 상태 — pending(대기) → running(claim됨) → done/failed. */
export const SCRAPE_REQUEST_STATUSES = [
  "pending",
  "running",
  "done",
  "failed",
] as const;

export const scrapeRequestStatusSchema = z.enum(SCRAPE_REQUEST_STATUSES);
export type ScrapeRequestStatus = z.infer<typeof scrapeRequestStatusSchema>;

export const scrapeRequestSchema = z.object({
  id: z.string().uuid(),
  requested_at: z.string(),
  requested_by: z.string(),
  status: scrapeRequestStatusSchema,
  claimed_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  message: z.string().nullable(),
  created_at: z.string(),
});

export type ScrapeRequest = z.infer<typeof scrapeRequestSchema>;
