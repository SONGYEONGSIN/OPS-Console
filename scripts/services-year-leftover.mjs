#!/usr/bin/env node
// services-year-patterns.mjs에서 잡힌 4 카테고리 외에 연도/회차/학기 keyword가
// 들어간 row가 있는지 누락 검출.
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

// 기존 4 패턴 (services-year-patterns.mjs와 동일)
const RE_HAKNYEONDO = /\d{4}\s*학년도/;
const RE_HOI = /제?\s*\d+\s*회/;
const RE_NYEON = /\d{4}\s*년(?!도)?/;
const RE_YEAR_PLAIN = /(?<![가-힣\d])(20\d{2})(?![가-힣\d])/;

function captured(name) {
  return (
    RE_HAKNYEONDO.test(name) ||
    RE_HOI.test(name) ||
    RE_NYEON.test(name) ||
    RE_YEAR_PLAIN.test(name)
  );
}

// 누락 후보 패턴 — year/season/iteration 관련 keyword (광범위)
const KEYWORDS = [
  { name: "년도", re: /\d+\s*년도/ }, // "2025년도" (학년도 제외)
  { name: "기/회기", re: /제\d+\s*회기|제\d+\s*기/ },
  { name: "학기", re: /[12]\s*학기/ },
  { name: "Fall/Spring", re: /\b(Fall|Spring|Autumn|Summer|Winter)\b/i },
  { name: "후기/전기", re: /(후기|전기)/ },
  { name: "축약연도", re: /'\d{2}/ }, // '25 같은
  { name: "year range", re: /\d{2,4}\s*[-~–]\s*\d{2,4}/ },
  { name: "기수", re: /\d+\s*기(?![가-힣])/ },
  { name: "차수만", re: /\d+\s*차(?![가-힣])/ },
  { name: "한자 학기/년", re: /(學期|學年|年度|年第)/ },
];

const leftoverByKeyword = new Map();
for (const r of all) {
  const name = r.service_name ?? "";
  if (captured(name)) continue;
  for (const kw of KEYWORDS) {
    if (kw.re.test(name)) {
      if (!leftoverByKeyword.has(kw.name)) leftoverByKeyword.set(kw.name, []);
      leftoverByKeyword.get(kw.name).push(r);
      break;
    }
  }
}

console.log(`[전수] ${all.length} services`);
console.log(`[기존 4 카테고리 누락 중 추가 패턴 후보]`);
let leftoverTotal = 0;
for (const [kw, rows] of leftoverByKeyword) {
  console.log(`\n### "${kw}" 패턴 (${rows.length}건)`);
  leftoverTotal += rows.length;
  for (const r of rows.slice(0, 10)) {
    console.log(`  ${r.service_id} ${r.university_name} · ${r.service_name}`);
  }
  if (rows.length > 10) console.log(`  ... +${rows.length - 10}건`);
}
console.log(`\n[합계 누락 후보] ${leftoverTotal}건`);
