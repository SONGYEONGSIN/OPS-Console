import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** 점검 대상 1건 — Moa 목록의 UnivServiceID 와 대조할 키가 serviceId. */
export type RatioAuditTarget = {
  serviceId: number;
  universityName: string;
  serviceName: string;
  operatorName: string;
};

/**
 * 점검 대상 = closing_services 의 수시 서비스.
 *
 * Moa 검색의 서버측 모집구분 필터에 의존하지 않고, 여기서 받은 serviceId 집합과
 * Moa 목록을 교집합해 대상을 정한다(스펙 부록 A — 서버 필터 신뢰하지 않음).
 * 스크래퍼가 CRON_SECRET 으로만 호출하므로 admin client(RLS bypass)를 쓴다.
 */
export async function listRatioAuditTargets(): Promise<RatioAuditTarget[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("closing_services")
    .select("service_id, university_name, service_name, operator_name")
    .eq("category", "수시");
  if (error) throw new Error(`[ratio-audit] 대상 조회 실패: ${error.message}`);
  return (data ?? []).map((r) => ({
    serviceId: r.service_id as number,
    universityName: (r.university_name as string | null) ?? "",
    serviceName: (r.service_name as string | null) ?? "",
    operatorName: (r.operator_name as string | null) ?? "",
  }));
}
