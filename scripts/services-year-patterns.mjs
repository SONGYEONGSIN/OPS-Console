import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const all = [];
const CHUNK = 1000;
for (let p = 0; ; p++) {
  const { data, error } = await s
    .from("services")
    .select("service_id, university_name, service_name")
    .order("service_id", { ascending: true })
    .range(p * CHUNK, (p + 1) * CHUNK - 1);
  if (error) {
    console.error(error);
    process.exit(1);
  }
  if (!data || data.length === 0) break;
  all.push(...data);
  if (data.length < CHUNK) break;
}
const data = all;

// 7 패턴 — 우선순위 순서로 매칭 (먼저 매칭된 카테고리에만 들어감)
const RE_HAKNYEONDO = /\d{4}\s*학년도/; // 2025학년도
const RE_HOI = /제?\s*\d+\s*회/; // 제22회, 22회
const RE_GI = /제?\s*\d+\s*기(?![가-힣])/; // 제75기, 63기 (기수/회기)
const RE_NYEONDO = /\d{4}\s*년도/; // 2025년도 (학년도 X — 위에서 분리됨)
const RE_NYEON = /\d{4}\s*년/; // 2025년 (학년도/년도 X — 위에서 분리됨)
const RE_YEAR_N = /(?<![가-힣\d])20\d{2}\s*[-~–]\s*\d/; // 2025-2, 2026-1 (학기 표기)
const RE_YEAR_PLAIN = /(?<![가-힣\d])(20\d{2})(?![가-힣\d])/; // 2025/2026 단독

const matches = {
  학년도: [],
  회: [],
  기: [],
  년도: [],
  년: [],
  연도N: [],
  연도: [],
};
const seen = new Set();

for (const r of data ?? []) {
  if (seen.has(r.service_id)) continue;
  const name = r.service_name ?? "";
  if (RE_HAKNYEONDO.test(name)) {
    matches.학년도.push(r);
    seen.add(r.service_id);
    continue;
  }
  if (RE_HOI.test(name)) {
    matches.회.push(r);
    seen.add(r.service_id);
    continue;
  }
  if (RE_GI.test(name)) {
    matches.기.push(r);
    seen.add(r.service_id);
    continue;
  }
  if (RE_NYEONDO.test(name)) {
    matches.년도.push(r);
    seen.add(r.service_id);
    continue;
  }
  if (RE_NYEON.test(name)) {
    matches.년.push(r);
    seen.add(r.service_id);
    continue;
  }
  if (RE_YEAR_N.test(name)) {
    matches.연도N.push(r);
    seen.add(r.service_id);
    continue;
  }
  if (RE_YEAR_PLAIN.test(name)) {
    matches.연도.push(r);
    seen.add(r.service_id);
  }
}

console.log(`[학년도 패턴] ${matches.학년도.length}건`);
console.log(`[회차 패턴] ${matches.회.length}건`);
console.log(`[~기 패턴] ${matches.기.length}건`);
console.log(`[~년도 패턴] ${matches.년도.length}건`);
console.log(`[~년 패턴] ${matches.년.length}건`);
console.log(`[연도-학기(2025-2) 패턴] ${matches.연도N.length}건`);
console.log(`[연도 단독(2025/2026)] ${matches.연도.length}건`);
const total =
  matches.학년도.length +
  matches.회.length +
  matches.기.length +
  matches.년도.length +
  matches.년.length +
  matches.연도N.length +
  matches.연도.length;
console.log(`[합계] ${total}건 / 전체 ${data?.length}`);

// 대학별 분포
function distByUni(rows) {
  const m = new Map();
  for (const r of rows) m.set(r.university_name, (m.get(r.university_name) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
console.log(`\n[대학별 분포 — 학년도]`);
for (const [u, n] of distByUni(matches.학년도)) console.log(`  ${u}: ${n}`);
console.log(`\n[대학별 분포 — ~년]`);
for (const [u, n] of distByUni(matches.년)) console.log(`  ${u}: ${n}`);
console.log(`\n[대학별 분포 — 연도 단독]`);
for (const [u, n] of distByUni(matches.연도)) console.log(`  ${u}: ${n}`);
console.log(`\n[대학별 분포 — 회차]`);
for (const [u, n] of distByUni(matches.회)) console.log(`  ${u}: ${n}`);
console.log(`\n[대학별 분포 — ~기]`);
for (const [u, n] of distByUni(matches.기)) console.log(`  ${u}: ${n}`);

// 파일 저장
import { writeFileSync } from "node:fs";
const out = [];
out.push(`# 서비스명 연도/회차 표기 — ${total}건 / 전체 ${data?.length}\n`);
out.push(`\n## 학년도 패턴 (${matches.학년도.length}건)\n`);
for (const r of matches.학년도)
  out.push(`- ${r.service_id} ${r.university_name} · ${r.service_name}`);
out.push(`\n## 회차 패턴 (${matches.회.length}건)\n`);
for (const r of matches.회)
  out.push(`- ${r.service_id} ${r.university_name} · ${r.service_name}`);
out.push(`\n## ~기 패턴 (${matches.기.length}건)\n`);
for (const r of matches.기)
  out.push(`- ${r.service_id} ${r.university_name} · ${r.service_name}`);
out.push(`\n## ~년도 패턴 (${matches.년도.length}건)\n`);
for (const r of matches.년도)
  out.push(`- ${r.service_id} ${r.university_name} · ${r.service_name}`);
out.push(`\n## ~년 패턴 (${matches.년.length}건)\n`);
for (const r of matches.년)
  out.push(`- ${r.service_id} ${r.university_name} · ${r.service_name}`);
out.push(`\n## 연도-학기(2025-2 등) (${matches.연도N.length}건)\n`);
for (const r of matches.연도N)
  out.push(`- ${r.service_id} ${r.university_name} · ${r.service_name}`);
out.push(`\n## 연도 단독(2025/2026 등) (${matches.연도.length}건)\n`);
for (const r of matches.연도)
  out.push(`- ${r.service_id} ${r.university_name} · ${r.service_name}`);
writeFileSync("docs/services-year-patterns.md", out.join("\n"));
console.log(`\n[file] docs/services-year-patterns.md 저장됨`);
