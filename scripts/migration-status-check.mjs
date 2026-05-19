// 마이그 적용 상태 점검 — 신규 3 테이블 + RLS 동작 검증
// - service_role: 테이블 존재 + row count
// - anon: select 시 RLS 차단되는지 (정책 없으면 0건 or 401)
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const svc = createClient(URL, SERVICE);
const anon = createClient(URL, ANON);

const TABLES = [
  { name: "handover_records", mig: "20260601_handover_records_table.sql + RLS" },
  { name: "handover_progress", mig: "20260603_handover_progress_table.sql + RLS" },
  { name: "worklog", mig: "20260604_worklog_table.sql + RLS" },
];

console.log("=== 1) service_role: 테이블 존재 + row count ===");
for (const t of TABLES) {
  const { count, error } = await svc
    .from(t.name)
    .select("id", { count: "exact", head: true });
  if (error) console.log(`  ✗ ${t.name} — ${error.message}`);
  else console.log(`  ✓ ${t.name} — ${count} rows  (${t.mig})`);
}

console.log("\n=== 2) anon: RLS 차단 여부 (auth 없이 select) ===");
for (const t of TABLES) {
  const { data: _data, error, count } = await anon
    .from(t.name)
    .select("id", { count: "exact", head: true });
  if (error) {
    // RLS 활성 + 정책 미일치 → 보통 PGRST301 또는 권한 거부 메시지
    console.log(`  ⛔ ${t.name} — anon 차단됨: ${error.code ?? "?"} ${error.message}`);
  } else if ((count ?? 0) === 0) {
    console.log(`  ⛔ ${t.name} — anon 결과 0건 (RLS 차단 또는 빈 테이블)`);
  } else {
    console.log(`  ⚠ ${t.name} — anon으로 ${count}건 노출됨 (RLS 점검 필요)`);
  }
}
