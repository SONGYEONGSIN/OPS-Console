// e2e 테스트로 생성된 projects + project_tasks 정리.
// project_tasks는 on delete cascade로 함께 삭제.
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data, error } = await s
  .from("projects")
  .delete()
  .or("name.ilike.[E2E]%,name.ilike.[TEST]%")
  .select("id, name");

if (error) {
  console.error(error);
  process.exit(1);
}
console.log(`삭제된 projects: ${data?.length ?? 0}`);
for (const p of data ?? []) console.log(`  - ${p.name} (${p.id})`);
