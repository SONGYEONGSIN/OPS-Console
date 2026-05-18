// todos.source_service_id 사용 row 개수 (drop column 안전성 점검)
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { count, error } = await s
  .from("todos")
  .select("id", { count: "exact", head: true })
  .not("source_service_id", "is", null);

if (error) { console.error(error); process.exit(1); }
console.log(`source_service_id NOT NULL row 개수: ${count}`);

const { count: total } = await s
  .from("todos")
  .select("id", { count: "exact", head: true });
console.log(`전체 todos: ${total}`);
