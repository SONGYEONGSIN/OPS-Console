import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const { data } = await s
  .from("services")
  .select("service_id, service_name, application_type")
  .eq("university_name", "숙명여자대학교");
for (const r of data ?? []) {
  console.log(`  ${r.service_id} [${r.application_type}] ${r.service_name}`);
}
