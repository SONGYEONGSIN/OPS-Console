// e2e cleanup — title이 '[E2E]' 접두사인 todos 모두 삭제
// 사용: node scripts/cleanup-test-todos.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8")
  .split("\n")
  .filter((l) => l && !l.startsWith("#"))
  .reduce((acc, l) => {
    const [k, ...v] = l.split("=");
    if (k) acc[k.trim()] = v.join("=").trim();
    return acc;
  }, {});

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { data, error } = await sb
  .from("todos")
  .delete()
  .like("title", "[E2E]%")
  .select();

if (error) {
  console.error("cleanup failed:", error.message);
  process.exit(1);
}

console.log(`✓ cleaned ${data?.length ?? 0} test todo(s)`);
