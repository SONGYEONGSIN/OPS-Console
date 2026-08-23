import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { BillingState } from "./completion";

/**
 * 대학별 정산기한 — 대학명 → 일수.
 *
 * 서비스가 아니라 **대학** 단위다. 같은 대학의 수시·정시가 기한을 따로 갖지 않아,
 * 한 번 정하면 그 대학 전체에 붙는다.
 */
export async function fetchSettlementDeadlines(): Promise<
  Record<string, number>
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settlement_deadlines")
    .select("university_name, days");

  const map: Record<string, number> = {};
  for (const r of (data ?? []) as { university_name: string; days: number }[]) {
    map[r.university_name] = r.days;
  }
  return map;
}

/**
 * 서비스ID → 정산·발행 상태.
 *
 * 목록에 있는 서비스만 물어본다 — 표 전체를 끌어오면 마감된 572건이 늘수록
 * 화면 열 때마다 같이 커진다.
 */
export async function fetchBillingStates(
  serviceIds: readonly number[],
): Promise<Record<number, BillingState>> {
  if (serviceIds.length === 0) return {};

  const supabase = await createClient();
  const { data } = await supabase
    .from("service_billing")
    .select("service_id, settled_at, issued_at")
    .in("service_id", [...serviceIds]);

  const map: Record<number, BillingState> = {};
  for (const r of (data ?? []) as {
    service_id: number;
    settled_at: string | null;
    issued_at: string | null;
  }[]) {
    map[r.service_id] = { settledAt: r.settled_at, issuedAt: r.issued_at };
  }
  return map;
}

/** 정산완료된 건수 — 계산서발행 메뉴의 범위이자 사이드바 숫자. */
export async function countSettled(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("service_billing")
    .select("service_id", { count: "exact", head: true })
    .not("settled_at", "is", null);
  return count ?? 0;
}

/**
 * 정산완료된 서비스ID 전부.
 *
 * '미완료' 칩이 완료된 건을 빼는 데 쓴다. 목록 크기는 마감된 서비스 수를 넘지
 * 않는다 — 수천을 넘어가면 `closing/id-filter.ts` 주석대로 DB 함수로 옮긴다.
 */
export async function listSettledServiceIds(): Promise<number[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_billing")
    .select("service_id")
    .not("settled_at", "is", null);
  return ((data ?? []) as { service_id: number }[]).map((r) => r.service_id);
}
