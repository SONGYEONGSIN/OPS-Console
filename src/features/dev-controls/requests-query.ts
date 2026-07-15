import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DevControlAnalyzeRequest } from "./schemas";

/** service_id별 최신 요청 1건 (배지 표시용). requested_at desc로 첫 건. */
export async function listLatestDevControlRequests(): Promise<
  Map<number, DevControlAnalyzeRequest>
> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("dev_control_analyze_requests")
    .select(
      "id, service_id, requested_by, status, requested_at, claimed_at, finished_at, message",
    )
    .order("requested_at", { ascending: false });
  if (error) throw new Error(`요청 조회 실패: ${error.message}`);
  const map = new Map<number, DevControlAnalyzeRequest>();
  for (const r of (data ?? []) as DevControlAnalyzeRequest[]) {
    if (!map.has(r.service_id)) map.set(r.service_id, r);
  }
  return map;
}
