import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DB_TABLES,
  type DbSnapshot,
  type DbSnapshotRow,
} from "./_db-shared";

/** 모든 테이블 head count 병렬 fetch. 실패한 테이블은 count=null. */
export async function getDbSnapshot(): Promise<DbSnapshot> {
  const admin = createAdminClient();
  const head = { count: "exact", head: true } as const;

  const results = await Promise.all(
    DB_TABLES.map(async (meta): Promise<DbSnapshotRow> => {
      const { count, error } = await admin.from(meta.table).select("*", head);
      if (error) {
        console.error(`[db-snapshot] ${meta.table}:`, error.message);
        return { ...meta, count: null };
      }
      return { ...meta, count: count ?? 0 };
    }),
  );

  return { rows: results, fetchedAt: new Date().toISOString() };
}
