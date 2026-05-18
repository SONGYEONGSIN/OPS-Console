#!/usr/bin/env node
// services 전수에서 의심스러운 leftover 패턴 검출
//  - 앞 하이픈/공백 + 숫자 시작
//  - 빈 괄호 안에 하이픈만 남음
//  - 단독 숫자만 있는 토큰 (특히 첫 토큰)
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const all = [];
for (let p = 0; ; p++) {
  const { data } = await s
    .from("services")
    .select("service_id, university_name, service_name")
    .order("service_id", { ascending: true })
    .range(p * 1000, (p + 1) * 1000 - 1);
  if (!data || data.length === 0) break;
  all.push(...data);
  if (data.length < 1000) break;
}

const patterns = [
  { name: "앞 하이픈+숫자", re: /^[\s-]*\d+\s/ },
  { name: "괄호 안 하이픈 시작", re: /\(\s*-/ },
  { name: "괄호 안 숫자만 토큰", re: /\(\s*\d+\s*[-]/ },
  { name: "괄호 안 단순 숫자", re: /\(\s*\d+\s*\)/ },
  { name: "앞 단독 숫자", re: /^\d+\s/ },
  { name: "공백+하이픈+숫자", re: /\s-\s*\d/ },
];

const hits = new Map();
for (const r of all) {
  const name = r.service_name ?? "";
  for (const pat of patterns) {
    if (pat.re.test(name)) {
      if (!hits.has(pat.name)) hits.set(pat.name, []);
      hits.get(pat.name).push(r);
    }
  }
}

for (const [pn, rows] of hits) {
  console.log(`\n### "${pn}" (${rows.length}건)`);
  for (const r of rows.slice(0, 20)) {
    console.log(`  ${r.service_id} ${r.university_name} · ${r.service_name}`);
  }
  if (rows.length > 20) console.log(`  ... +${rows.length - 20}`);
}
