#!/usr/bin/env node
// 연도 strip 후 leftover 정리:
//  - "(-X)" → "(X)"  (괄호 안 하이픈 잔존, 7건)
//  - 앞 단독 숫자 "N " → 제거 (year-N 패턴에서 N만 남은 경우, 경기대 4건)
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });
const DRY_RUN = process.env.DRY_RUN === "true";
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const all = [];
for (let p = 0; ; p++) {
  const { data } = await s
    .from("services")
    .select("id, service_id, university_name, service_name")
    .order("service_id", { ascending: true })
    .range(p * 1000, (p + 1) * 1000 - 1);
  if (!data || data.length === 0) break;
  all.push(...data);
  if (data.length < 1000) break;
}

function clean(name) {
  let s = name;
  // 괄호 안 하이픈 시작 제거 — (-가을) → (가을)
  s = s.replace(/\(\s*-+\s*/g, "(");
  // 대괄호도 동일
  s = s.replace(/\[\s*-+\s*/g, "[");
  // 앞 단독 숫자 토큰 제거 — "2 외국인..." → "외국인..."
  s = s.replace(/^\s*\d+\s+/, "");
  // 정리
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

const changes = [];
for (const r of all) {
  const before = r.service_name ?? "";
  const after = clean(before);
  if (after !== before) {
    changes.push({ ...r, before, after });
  }
}

console.log(`[변경 대상] ${changes.length}건`);
for (const c of changes) {
  console.log(`  ${c.service_id} ${c.university_name}`);
  console.log(`    "${c.before}" → "${c.after}"`);
}

if (DRY_RUN) {
  console.log(`\n[DRY_RUN]`);
  process.exit(0);
}
let ok = 0;
for (const c of changes) {
  const { error } = await s
    .from("services")
    .update({ service_name: c.after })
    .eq("id", c.id);
  if (error) {
    console.error(`[fail] ${c.service_id}: ${error.message}`);
    continue;
  }
  ok++;
}
console.log(`\n[OK] ${ok}/${changes.length} updated`);
