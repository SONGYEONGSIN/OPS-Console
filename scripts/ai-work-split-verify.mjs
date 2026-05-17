// ai_work.work_date 컬럼 분할 마이그 적용 검증.
// 기대: work_start_date / work_end_date 컬럼 존재, work_date 컬럼 부재.
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

console.log("=== ai_work 컬럼 분할 확인 ===");
// 새 컬럼 select 가능?
const { data, error } = await svc
  .from("ai_work")
  .select("id, work_start_date, work_end_date")
  .limit(3);

if (error) {
  console.log("✗ work_start_date / work_end_date 조회 실패:");
  console.log("  ", error.message);
  console.log("→ supabase/migrations/20260606_ai_work_split_work_date.sql 적용 필요");
  process.exit(1);
}

console.log(`✓ work_start_date / work_end_date 컬럼 존재 (sample ${data?.length ?? 0}건)`);
for (const r of data ?? []) {
  console.log(`  ${r.id} — ${r.work_start_date} ~ ${r.work_end_date}`);
}

// 옛 컬럼 잔존 여부 (negative test)
const { error: legacyError } = await svc
  .from("ai_work")
  .select("work_date")
  .limit(1);

if (legacyError) {
  console.log("✓ work_date 컬럼 제거됨 (예상 동작)");
} else {
  console.log("⚠ work_date 컬럼이 아직 존재함 — 마이그 6단계(drop column) 확인 필요");
}
