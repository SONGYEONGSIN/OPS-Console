// todos.source_service_id 컬럼 마이그 검증
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data, error } = await svc
  .from("todos")
  .select("id, source_service_id")
  .limit(1);

if (error) {
  console.log("✗ todos.source_service_id 조회 실패:", error.message);
  console.log("→ supabase/migrations/20260608_todos_source_service_id.sql 적용 필요");
  process.exit(1);
}

console.log(`✓ todos.source_service_id 컬럼 존재 (sample ${data?.length ?? 0}건)`);
