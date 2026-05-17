import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// listServicesWithHandover와 동일한 select
const { data, error } = await s
  .from("services")
  .select(
    "id, service_id, university_name, service_name, handover_records(status, contract_info_md, work_basic_md)",
  )
  .eq("service_id", 6007001);

if (error) console.error("err", error);
console.log(JSON.stringify(data, null, 2));
