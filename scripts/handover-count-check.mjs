import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// 1) services total
const { count: totalServices } = await s
  .from("services")
  .select("id", { count: "exact", head: true });
console.log(`[services total] ${totalServices}`);

// 2) handover_records total
const { count: totalHandover } = await s
  .from("handover_records")
  .select("id", { count: "exact", head: true });
console.log(`[handover_records total] ${totalHandover}`);

// 3) 현재 operators (로그인 가능한 사용자) 확인
const { data: ops } = await s
  .from("operators")
  .select("email, name, status, permission")
  .eq("status", "active");
console.log(`\n[operators active]`);
for (const o of ops) console.log(`  ${o.email} (${o.name}) ${o.permission}`);

// 4) services 중 operator_email 분포 top 10
const { data: svc } = await s.from("services").select("operator_email");
const dist = new Map();
for (const r of svc ?? []) {
  const k = r.operator_email ?? "(null)";
  dist.set(k, (dist.get(k) ?? 0) + 1);
}
console.log(`\n[services by operator_email]`);
for (const [k, v] of [...dist.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${v}`);
}
