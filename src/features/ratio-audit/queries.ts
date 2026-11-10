import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  matchesRatioAuditFilters,
  type RatioAuditFilters,
} from "./run-filters";

/** 점검 대상 1건 — Moa 목록의 UnivServiceID 와 대조할 키가 serviceId. */
export type RatioAuditTarget = {
  serviceId: number;
  universityName: string;
  serviceName: string;
  operatorName: string;
};

// PostgREST 기본 상한(1000행)에 걸려 일부가 오류 없이 빠지지 않도록 페이지로 끝까지 읽는다
const PAGE = 1000;

type ClosingRow = {
  service_id: number;
  university_name: string | null;
  service_name: string | null;
  operator_name: string | null;
  university_type: string | null;
  category: string | null;
};

async function readOpenClosingRows(now: Date): Promise<ClosingRow[]> {
  const admin = createAdminClient();
  const rows: ClosingRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("closing_services")
      .select(
        "service_id, university_name, service_name, operator_name, university_type, category",
      )
      .gte("write_end_at", now.toISOString())
      .order("service_id")
      .range(from, from + PAGE - 1);
    if (error)
      throw new Error(`[ratio-audit] 대상 조회 실패: ${error.message}`);
    const page = (data ?? []) as ClosingRow[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

/**
 * 점검 대상 = 실행 조건(대학구분·모집구분) × 접수 마감 전인 closing_services 서비스.
 * 기간은 DB 에서(write_end_at ≥ now), 대학구분·모집구분은 matchesRatioAuditFilters 로 거른다.
 *
 * Moa 검색의 서버측 모집구분 필터에 의존하지 않고, 여기서 받은 serviceId 집합과
 * Moa 목록을 교집합해 대상을 정한다(스펙 부록 A — 서버 필터 신뢰하지 않음).
 * 스크래퍼가 CRON_SECRET 으로만 호출하므로 admin client(RLS bypass)를 쓴다.
 */
export async function listRatioAuditTargets(
  filters: RatioAuditFilters,
  now: Date,
): Promise<RatioAuditTarget[]> {
  const rows = await readOpenClosingRows(now);
  return rows
    .filter((r) => matchesRatioAuditFilters(r, filters))
    .map((r) => ({
      serviceId: r.service_id,
      universityName: r.university_name ?? "",
      serviceName: r.service_name ?? "",
      operatorName: r.operator_name ?? "",
    }));
}
