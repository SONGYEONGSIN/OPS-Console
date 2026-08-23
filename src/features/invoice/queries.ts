import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceState } from "./rows";

/**
 * 계산서발행 목록의 재료.
 *
 * 목록 범위는 **정산완료된 서비스**다. `service_billing` 과 `closing_services` 는
 * FK 가 없어(스크랩 미러) DB 조인을 못 걸므로, 여기서 ID 를 받아 목록 쿼리에 넘긴다.
 */

/** 정산완료된 서비스ID 전부 — 계산서발행 목록의 범위. */
export async function listSettledServiceIds(): Promise<number[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_billing")
    .select("service_id")
    .not("settled_at", "is", null);
  return ((data ?? []) as { service_id: number }[]).map((r) => r.service_id);
}

/** 서비스ID → 정산·발행 상태. 목록에 있는 것만 물어본다. */
export async function fetchInvoiceStates(
  serviceIds: readonly number[],
): Promise<Record<number, InvoiceState>> {
  if (serviceIds.length === 0) return {};

  const supabase = await createClient();
  const { data } = await supabase
    .from("service_billing")
    .select("service_id, settled_at, issued_at, issue_type, settled_amount")
    .in("service_id", [...serviceIds]);

  const map: Record<number, InvoiceState> = {};
  for (const r of (data ?? []) as {
    service_id: number;
    settled_at: string | null;
    issued_at: string | null;
    issue_type: string | null;
    settled_amount: number | null;
  }[]) {
    map[r.service_id] = {
      settledAt: r.settled_at,
      issuedAt: r.issued_at,
      issueType: r.issue_type,
      billedAmount: r.settled_amount,
    };
  }
  return map;
}
