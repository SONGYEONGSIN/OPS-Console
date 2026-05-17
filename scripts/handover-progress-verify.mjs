import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const { count, error } = await s
  .from("handover_progress")
  .select("id", { count: "exact", head: true });
if (error) console.error("✗", error.message);
else console.log(`✓ handover_progress 존재 — ${count} rows`);
