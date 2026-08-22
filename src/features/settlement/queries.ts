import "server-only";
import { createClient } from "@/lib/supabase/server";

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
