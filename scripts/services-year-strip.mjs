#!/usr/bin/env node
// 322 row의 service_name에서 연도/학년도/회차/기수/~년 패턴 제거.
//   DRY_RUN=true node scripts/services-year-strip.mjs  # 변경 미리보기 + 중복 검출
//   node scripts/services-year-strip.mjs               # 실제 update
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

/** service_name에서 연도/학년도/회차/기수 패턴 제거 */
function strip(name) {
  let s = name;
  // 순서 중요: 학년도 → 회차 → ~기 → ~년 → 단독 연도
  s = s.replace(/\d{4}\s*학년도\s*/g, "");
  s = s.replace(/제?\s*\d+\s*회\s*/g, "");
  s = s.replace(/제?\s*\d+\s*기(?![가-힣])\s*/g, "");
  s = s.replace(/\d{4}\s*년도\s*/g, ""); // 2025년도
  s = s.replace(/\d{4}\s*년\s*/g, ""); // 2025년 (학년도/년도는 이미 처리됨)
  s = s.replace(/(?<![가-힣\d])(20\d{2})(?![가-힣\d])\s*/g, "");
  // 정리: 빈 괄호/대괄호 제거, 다중 공백/하이픈 정리
  s = s.replace(/\[\s*\]/g, "");
  s = s.replace(/\(\s*\)/g, "");
  s = s.replace(/\[\s*[-~–]?\s*\]/g, "");
  s = s.replace(/\(\s*[-~–]?\s*\)/g, "");
  s = s.replace(/^\s*[-~–]\s*/, ""); // 앞 하이픈
  s = s.replace(/\s*[-~–]\s*$/, ""); // 뒤 하이픈
  s = s.replace(/\s+/g, " ").trim();
  // 앞뒤 구분자
  s = s.replace(/^[,·\-]+\s*/, "").trim();
  s = s.replace(/\s*[,·\-]+$/, "").trim();
  return s;
}

const RE_ANY = /\d{4}\s*학년도|제?\s*\d+\s*회|제?\s*\d+\s*기(?![가-힣])|\d{4}\s*년도|\d{4}\s*년|(?<![가-힣\d])20\d{2}(?![가-힣\d])/;

const changes = [];
for (const r of all) {
  const before = r.service_name ?? "";
  if (!RE_ANY.test(before)) continue;
  const after = strip(before);
  if (after === before) continue;
  changes.push({
    id: r.id,
    service_id: r.service_id,
    university_name: r.university_name,
    before,
    after,
  });
}

console.log(`[변경 대상] ${changes.length}건`);

// 같은 university_name 내 중복 검사 (after 기준)
const dupMap = new Map();
for (const c of changes) {
  const key = `${c.university_name}|${c.after}`;
  if (!dupMap.has(key)) dupMap.set(key, []);
  dupMap.get(key).push(c);
}

// 변경 후 다른 services(미변경 포함)와도 충돌 검사
const existingByUni = new Map();
for (const r of all) {
  const key = `${r.university_name}|${r.service_name}`;
  existingByUni.set(key, (existingByUni.get(key) ?? 0) + 1);
}

const collisions = [];
for (const c of changes) {
  // changes 내부 동일 변경 후 이름 발생
  const sameAfter = dupMap
    .get(`${c.university_name}|${c.after}`)
    .filter((x) => x.service_id !== c.service_id);
  if (sameAfter.length > 0) {
    collisions.push({
      kind: "변경끼리 충돌",
      target: c,
      others: sameAfter.map((x) => x.service_id),
    });
    continue;
  }
  // 변경 후 이름이 (다른 미변경 row의) 기존 service_name과 일치
  const existing = existingByUni.get(`${c.university_name}|${c.after}`) ?? 0;
  if (existing > 0) {
    collisions.push({
      kind: "기존 row와 충돌",
      target: c,
      others: [`existing service_name="${c.after}"`],
    });
  }
}

console.log(`\n[처음 20개 미리보기 — before → after]`);
for (const c of changes.slice(0, 20)) {
  console.log(
    `  ${c.service_id} ${c.university_name}\n    "${c.before}"\n  → "${c.after}"`,
  );
}

console.log(`\n[충돌 검출] ${collisions.length}건`);
const seen = new Set();
for (const x of collisions) {
  const key = `${x.target.university_name}|${x.target.after}`;
  if (seen.has(key)) continue;
  seen.add(key);
  console.log(`  ${x.kind}: ${x.target.university_name} · "${x.target.after}"`);
  console.log(`    target: ${x.target.service_id} "${x.target.before}"`);
  console.log(`    others: ${x.others.join(", ")}`);
}

// after가 빈 문자열로 끝나는 경우 — 위험
const emptyAfter = changes.filter((c) => !c.after || c.after.trim() === "");
console.log(`\n[빈 결과] ${emptyAfter.length}건 — service_name이 완전히 비게 됨`);
for (const c of emptyAfter) {
  console.log(`  ${c.service_id} ${c.university_name} · "${c.before}" → (빈 값)`);
}

if (DRY_RUN) {
  console.log(`\n[DRY_RUN] 실제 update 안 함. 확인 후 DRY_RUN 빼고 재실행.`);
  process.exit(0);
}

// 실제 update — chunk 50씩
let ok = 0;
for (const c of changes) {
  if (!c.after || c.after.trim() === "") {
    console.warn(`[skip] ${c.service_id} after 빈 값`);
    continue;
  }
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
