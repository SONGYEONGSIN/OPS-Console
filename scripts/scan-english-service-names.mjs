#!/usr/bin/env node
// services.service_name에 영문자가 포함된 row를 일괄 조회 — 한글화 후보 추출
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const all = [];
for (let p = 0; ; p++) {
  const { data, error } = await s
    .from("services")
    .select("service_id, university_name, service_name")
    .order("service_id", { ascending: true })
    .range(p * 1000, (p + 1) * 1000 - 1);
  if (error) {
    console.error("query error:", error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) break;
  all.push(...data);
  if (data.length < 1000) break;
}

const englishRe = /[A-Za-z]/;
const counts = new Map();
for (const row of all) {
  if (englishRe.test(row.service_name)) {
    counts.set(row.service_name, (counts.get(row.service_name) ?? 0) + 1);
  }
}

console.log(`전체 services: ${all.length}건`);
console.log(`영문자 포함 service_name 종류: ${counts.size}개\n`);
const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
for (const [name, n] of sorted) {
  console.log(`  ${n.toString().padStart(4)}건  ${name}`);
}
