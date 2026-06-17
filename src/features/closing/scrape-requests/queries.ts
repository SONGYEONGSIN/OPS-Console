import "server-only";
import { createClient } from "@/lib/supabase/server";
import { scrapeRequestSchema, type ScrapeRequest } from "./schemas";

/** 최신 로컬 스크랩 요청 1건 (UI 상태 표시용). 없거나 파싱 실패 시 null. */
export async function getLatestScrapeRequest(): Promise<ScrapeRequest | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("closing_scrape_requests")
    .select("*")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const parsed = scrapeRequestSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
