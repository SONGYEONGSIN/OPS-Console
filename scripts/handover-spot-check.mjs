import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const targets = [6007001, 6007007, 1098001, 1154002, 1009002];
for (const sid of targets) {
  const { data: svc } = await s
    .from("services")
    .select("id, service_id, service_name")
    .eq("service_id", sid)
    .maybeSingle();
  if (!svc) {
    console.log(`✗ ${sid}: service 없음`);
    continue;
  }
  const { data: rec } = await s
    .from("handover_records")
    .select(
      "status, contract_info_md, work_basic_md, school_contact_md, notes_md, author_email, updated_at",
    )
    .eq("service_id", svc.id)
    .maybeSingle();
  if (!rec) {
    console.log(`✗ ${sid} [${svc.service_name}] → handover_records 없음`);
    continue;
  }
  console.log(`\n✓ ${sid} [${svc.service_name}] — status=${rec.status}`);
  console.log(`  author=${rec.author_email}, updated=${rec.updated_at}`);
  console.log(
    `  contract_info_md: ${(rec.contract_info_md ?? "(null)").slice(0, 60)}…`,
  );
  console.log(
    `  work_basic_md   : ${(rec.work_basic_md ?? "(null)").slice(0, 60)}…`,
  );
  console.log(
    `  school_contact_md: ${(rec.school_contact_md ?? "(null)").slice(0, 60)}`,
  );
}
