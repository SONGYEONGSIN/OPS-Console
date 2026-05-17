import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// page.tsx의 listServicesWithHandover와 동일 — 필터 없음, page 1, pageSize 30
const { data, count, error } = await s
  .from("services")
  .select(
    "id, service_id, university_name, service_name, application_type, operator_name, handover_records(status, contract_info_md)",
    { count: "exact" },
  )
  .order("service_id", { ascending: true })
  .range(0, 29);

if (error) {
  console.error(error);
  process.exit(1);
}

console.log(`[count.exact] ${count}`);
console.log(`[rows returned] ${data.length}`);
console.log(`\n[처음 30 row]`);
let withRec = 0;
for (const r of data) {
  const rec = r.handover_records ?? null;
  if (rec) withRec++;
  console.log(
    `  ${r.service_id} ${r.university_name} · ${r.service_name} → ${rec ? rec.status : "(none)"}`,
  );
}
console.log(`\n[record 있는 row] ${withRec}/30`);
