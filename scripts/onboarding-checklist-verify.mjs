// 마이그 적용 검증 — onboarding_checklist_items 테이블 + RLS
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const svc = createClient(URL, SERVICE);
const anon = createClient(URL, ANON);

const TABLE = "onboarding_checklist_items";

console.log("=== 1) 테이블 존재 + row count ===");
const { count, error } = await svc
  .from(TABLE)
  .select("id", { count: "exact" });
if (error) {
  console.log(`✗ ${TABLE} — ${error.message}`);
  console.log("→ supabase/migrations/20260605_onboarding_checklist_items_table.sql 적용 필요");
  process.exit(1);
}
console.log(`✓ ${TABLE} — ${count} rows`);

console.log("\n=== 2) anon RLS 차단 ===");
const { error: anonErr, count: anonCount } = await anon
  .from(TABLE)
  .select("id", { count: "exact", head: true });
if (anonErr) {
  console.log(`✓ anon 차단됨: ${anonErr.code ?? "?"} ${anonErr.message}`);
} else if ((anonCount ?? 0) === 0) {
  console.log(`✓ anon 결과 0건 (RLS 정상)`);
} else {
  console.log(`⚠ anon으로 ${anonCount}건 노출 — RLS 점검 필요`);
}
