import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// operators 전원에 대해 본인 services 카운트 (operator OR developer)
const { data: ops } = await s
  .from("operators")
  .select("email, name")
  .eq("status", "active");

console.log(`[본인 services = operator_email OR developer_email]`);
for (const o of ops) {
  const { count } = await s
    .from("services")
    .select("id", { count: "exact", head: true })
    .or(`operator_email.eq.${o.email},developer_email.eq.${o.email}`);
  console.log(`  ${o.email} (${o.name}): ${count}`);
}
