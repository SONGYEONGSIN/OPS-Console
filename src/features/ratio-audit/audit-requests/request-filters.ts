import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ratioAuditFiltersSchema,
  type RatioAuditFilters,
} from "../run-filters";

export type RequestFiltersLookup =
  | { status: "found"; filters: RatioAuditFilters }
  | { status: "missing_filters" }
  | { status: "not_found" };

/**
 * 요청 행에 저장된 실행 조건을 읽는다.
 *
 * - 조회 오류는 던진다(supabase-js 는 스스로 안 던지므로 error 를 직접 본다)
 * - 행이 없으면 not_found
 * - filters 가 null(옛 요청)이거나 스키마를 못 넘으면(깨진 값) 모두 missing_filters
 *   — 저장 때와 같은 스키마를 거치므로 순서·중복도 정규화된다
 */
export async function loadRequestFilters(
  requestId: string,
): Promise<RequestFiltersLookup> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ratio_audit_requests")
    .select("id, filters")
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { status: "not_found" };

  const parsed = ratioAuditFiltersSchema.safeParse(data.filters);
  if (!parsed.success) return { status: "missing_filters" };
  return { status: "found", filters: parsed.data };
}
