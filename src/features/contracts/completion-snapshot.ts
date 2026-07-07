import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { listContracts } from "./queries";
import { isContractCompleted } from "./completion";

/** KST 기준 현재 월 'YYYY-MM'. */
export function kstYm(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .slice(0, 7);
}

/** 계약 시트에서 현재 '완료' 건수 (라이브). 실패 시 0. */
export async function countCompletedContracts(): Promise<number> {
  try {
    const r = await listContracts();
    return r.rows.filter((row) => isContractCompleted(row.status)).length;
  } catch {
    return 0;
  }
}

/** 월 스냅샷 upsert (ym 유니크). service_role admin 경유. */
export async function upsertCompletionSnapshot(
  ym: string,
  count: number,
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("contract_completion_snapshots")
    .upsert({ ym, completed_count: count }, { onConflict: "ym" });
}

/** 특정 월 스냅샷 완료 건수 (없으면 null). */
export async function getSnapshotCount(ym: string): Promise<number | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("contract_completion_snapshots")
    .select("completed_count")
    .eq("ym", ym)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { completed_count: number }).completed_count;
}
