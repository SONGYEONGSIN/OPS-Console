// 20260609 migration 적용 검증 — application/pims 타입 insert 시도
// 사용: node scripts/verify-schedule-types-migration.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8")
  .split("\n")
  .filter((l) => l && !l.startsWith("#"))
  .reduce((acc, l) => {
    const [k, ...v] = l.split("=");
    if (k) acc[k.trim()] = v.join("=").trim();
    return acc;
  }, {});

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const probes = ["application", "pims"];
const results = [];

for (const type of probes) {
  const { data, error } = await sb
    .from("schedule_events")
    .insert({
      type,
      title: `[MIGRATION-VERIFY] ${type}`,
      start_at: new Date().toISOString(),
      end_at: null,
      all_day: false,
      created_by_email: "ys1114@jinhakapply.com",
    })
    .select()
    .single();

  if (error) {
    results.push({ type, ok: false, message: error.message });
    continue;
  }
  results.push({ type, ok: true, id: data.id });

  await sb.from("schedule_events").delete().eq("id", data.id);
}

console.log("schedule_events type check 검증:");
for (const r of results) {
  console.log(`  ${r.ok ? "✓" : "✗"} type='${r.type}': ${r.ok ? "insert+delete OK" : r.message}`);
}

const allOk = results.every((r) => r.ok);
process.exit(allOk ? 0 : 1);
