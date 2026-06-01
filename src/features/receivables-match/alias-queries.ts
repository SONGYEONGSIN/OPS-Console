import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type AliasRow = { alias_key: string; alias_value: string };

/** alias 행 배열 → normalizeName extraAliases 맵. key/value 누락 행은 제외. */
export function aliasRowsToMap(rows: AliasRow[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const r of rows) {
    if (r.alias_key && r.alias_value) map[r.alias_key] = r.alias_value;
  }
  return map;
}

/** DB의 학습 alias 전체를 normalizeName용 맵으로 로드 (잡 시작 시 1회). */
export async function fetchMatchAliases(): Promise<Record<string, string>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("receivables_match_aliases")
    .select("alias_key, alias_value");
  return aliasRowsToMap((data ?? []) as AliasRow[]);
}

export type InsertAliasInput = {
  alias_key: string;
  alias_value: string;
  source_misu_customer: string;
  source_dep_content: string;
  created_by: string;
};

/** alias 학습 — alias_key 충돌 시 upsert (재승인 안전). */
export async function insertMatchAlias(
  input: InsertAliasInput,
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("receivables_match_aliases")
    .upsert(
      {
        alias_key: input.alias_key,
        alias_value: input.alias_value,
        source_misu_customer: input.source_misu_customer,
        source_dep_content: input.source_dep_content,
        created_by: input.created_by,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "alias_key" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
