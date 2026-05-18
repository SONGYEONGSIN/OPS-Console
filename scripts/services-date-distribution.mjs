// 운영부 달력에 services가 보이는지 진단 — write 날짜 월별 분포
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data, error } = await s
  .from("services")
  .select("service_name, write_start_at, write_end_at")
  .order("write_start_at", { ascending: true, nullsFirst: false });

if (error) { console.error(error); process.exit(1); }

const total = data.length;
const bothNull = data.filter(r => !r.write_start_at && !r.write_end_at).length;
const hasDate = data.filter(r => r.write_start_at || r.write_end_at);
console.log(`총 ${total}건, write 날짜 둘 다 null: ${bothNull}, 날짜 있음: ${hasDate.length}`);

const byMonth = new Map();
for (const r of hasDate) {
  for (const f of ["write_start_at", "write_end_at"]) {
    if (!r[f]) continue;
    const ym = r[f].slice(0, 7);
    byMonth.set(ym, (byMonth.get(ym) ?? 0) + 1);
  }
}
const sorted = [...byMonth.entries()].sort();
console.log("\n월별 분포 (write_start + write_end 각 1건씩):");
for (const [ym, n] of sorted) console.log(`  ${ym}: ${n}건`);
