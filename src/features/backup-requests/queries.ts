import "server-only";
import { createClient } from "@/lib/supabase/server";
import { backupRequestRowSchema, type BackupRequestRow } from "./schemas";

/**
 * 백업 요청 목록 fetch (RSC).
 * RLS: authenticated → 모든 row read 허용 (전원 가시 정책).
 * 정렬: created_at desc. 최대 100건.
 */
export async function listBackupRequests(): Promise<BackupRequestRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("backup_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[listBackupRequests] supabase error:", error);
    return [];
  }

  const parsed: BackupRequestRow[] = [];
  for (const row of data ?? []) {
    const r = backupRequestRowSchema.safeParse(row);
    if (r.success) parsed.push(r.data);
    else
      console.error(
        "[listBackupRequests] zod parse fail:",
        r.error.issues,
        "row:",
        row,
      );
  }
  return parsed;
}

/**
 * 단건 fetch (인스펙터 진입용 등).
 */
export async function getBackupRequestById(
  id: string,
): Promise<BackupRequestRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("backup_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[getBackupRequestById] supabase error:", error);
    return null;
  }
  if (!data) return null;

  const r = backupRequestRowSchema.safeParse(data);
  if (!r.success) {
    console.error("[getBackupRequestById] zod parse fail:", r.error.issues);
    return null;
  }
  return r.data;
}
