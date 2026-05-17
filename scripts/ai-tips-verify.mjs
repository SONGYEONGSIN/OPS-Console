// ai_tips 마이그 적용 검증 — table + RLS
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

console.log("=== 1) 테이블 존재 + row count ===");
const { count, error } = await svc.from("ai_tips").select("id", { count: "exact" });
if (error) {
  console.log("✗ ai_tips —", error.message);
  console.log("→ supabase/migrations/20260607_ai_tips_table.sql 적용 필요");
  process.exit(1);
}
console.log(`✓ ai_tips — ${count} rows`);

console.log("\n=== 2) anon RLS 차단 ===");
const { error: anonErr, count: anonCount } = await anon
  .from("ai_tips")
  .select("id", { count: "exact" });
if (anonErr) {
  console.log(`✓ anon 차단됨: ${anonErr.code ?? "?"} ${anonErr.message}`);
} else if ((anonCount ?? 0) === 0) {
  console.log(`✓ anon 결과 0건 (RLS 또는 빈 테이블)`);
} else {
  console.log(`⚠ anon으로 ${anonCount}건 노출됨 — RLS 점검 필요`);
}
