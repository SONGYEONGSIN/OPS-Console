import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { count: total } = await s.from("handover_records").select("id", { count: "exact", head: true });
const { data: byStatus } = await s.from("handover_records").select("status");
const dist = byStatus.reduce((m, r) => { m[r.status] = (m[r.status] ?? 0) + 1; return m; }, {});
console.log(`[total] ${total} records`);
console.log(`[status] ${JSON.stringify(dist)}`);
