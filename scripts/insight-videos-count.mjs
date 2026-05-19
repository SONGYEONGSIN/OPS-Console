// insight_videos DB row 개수 + 최신/오래된 collected_at 확인
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { count } = await s
  .from("insight_videos")
  .select("id", { count: "exact", head: true });
console.log(`insight_videos 총 ${count}건`);

const { data } = await s
  .from("insight_videos")
  .select("title, keyword, collected_at, published_at")
  .order("collected_at", { ascending: false })
  .limit(15);
console.log("\n최신 수집 15건 (collected_at desc):");
for (const r of data ?? [])
  console.log(`  ${r.collected_at?.slice(0, 10)} | ${r.keyword.padEnd(10)} | ${r.title.slice(0, 50)}`);
